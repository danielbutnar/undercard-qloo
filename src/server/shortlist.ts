import { z } from "zod";
import {
  headlinerTagWeights,
  sharedTags,
  type AssemblyInput,
} from "@/lib/assemble-lineup";
import type { TraceCall } from "@/lib/build-events";
import { FEE_BAND_IDS, feeBandFor } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import { foundOnQloo, pickTests } from "@/lib/pick-tests";
import {
  climbOf,
  distinctNames,
  placesIn,
  sameAnswer,
  SHORTLIST_CALL_CAP,
  SHORTLIST_MAX_NAMES,
  sortShortlist,
  type Climb,
  type Repeat,
  type Shortlist,
  type ShortlistAct,
  type ShortlistExample,
  type VenuePlaces,
} from "@/lib/shortlist";
import { festivalById } from "@/lib/towns";
import { venueHues } from "@/lib/venue-colours";
import {
  createBuildStore,
  type BuildContext,
  type BuildStore,
  type SavedBuild,
} from "./build-store";
import { serverCachedQloo, serverQloo } from "./deps";
import { savedLlmOnly } from "./llm-only";
import {
  createQlooClient,
  QlooBusy,
  QlooCacheMiss,
  QlooError,
  type QlooCall,
  type QlooClient,
  type QlooEntity,
  type QlooResult,
} from "./qloo";
import { createMemoryCache, syntheticMode, type QlooCache } from "./qloo-cache";
import type { RateLimiter } from "./rate-limit";

/** One Qloo call a check may make, run against the client the budget gives it. */
export type ShortlistTask<T extends unknown[]> = (
  qloo: QlooClient,
) => Promise<QlooResult<T>>;

/**
 * A check's Qloo calls under its hard cap (WS4, step 4). A call the server's Qloo cache answers
 * costs nothing and still lists, marked cached; `made` counts the calls that reached Qloo. When
 * a batch holds more calls than the cap leaves, the cache answers what it can first, and the
 * calls that must reach Qloo take what's left in order: the rest aren't made, and their result is
 * null, as a cache-only client's miss is.
 */
export function callBudget({
  live,
  cached,
  cap,
}: {
  /** Calls that may reach Qloo go here (cache first, as every client reads). */
  live: QlooClient;
  /** Reads the cache only, never Qloo. */
  cached: QlooClient;
  /** The most calls one check may make. */
  cap: number;
}) {
  let made = 0;
  async function attempt<T extends unknown[]>(
    task: ShortlistTask<T>,
    qloo: QlooClient,
  ): Promise<QlooResult<T> | null> {
    try {
      return await task(qloo);
    } catch (error) {
      if (error instanceof QlooCacheMiss) return null;
      throw error;
    }
  }
  return {
    cap,
    async run<T extends unknown[]>(
      tasks: readonly ShortlistTask<T>[],
    ): Promise<(QlooResult<T> | null)[]> {
      let spare = cap - made;
      const results =
        tasks.length <= spare
          ? await Promise.all(tasks.map((task) => attempt(task, live)))
          : await Promise.all(
              (
                await Promise.all(tasks.map((task) => attempt(task, cached)))
              ).map((hit, index) =>
                hit ? hit : spare-- > 0 ? attempt(tasks[index], live) : null,
              ),
            );
      made += results.filter((result) => result && !result.call.cached).length;
      return results;
    },
    made: () => made,
  };
}

export type CallBudget = ReturnType<typeof callBudget>;

/** A pasted name on Qloo: the act it found, or why there's none. */
export type ResolvedName =
  | { name: string; status: "found"; artist: QlooEntity }
  | { name: string; status: "headliner"; artist: QlooEntity }
  | { name: string; status: "not-found" }
  | { name: string; status: "not-checked" };

/**
 * Step 1: each name once, searched on Qloo as an artist; its act is the first of search's top
 * five that matches it after section 18's normalising (foundOnQloo), so a near miss is not found,
 * never guessed. A match needs the same normalised name, so two names for one act are a repeat
 * before any search. A headliner is marked, not ranked; a search not made is not checked.
 */
export async function resolveNames({
  names,
  budget,
  headlinerIds,
  tagWeights,
}: {
  names: readonly string[];
  budget: CallBudget;
  headlinerIds: ReadonlySet<string>;
  /** The headliners' genre weights: between two acts of one name, theirs decides (WS13.6). */
  tagWeights?: ReadonlyMap<string, number>;
}): Promise<{
  acts: ResolvedName[];
  repeats: Repeat[];
  calls: QlooCall[];
}> {
  const typed = distinctNames(names);
  const results = await budget.run(
    typed.names.map((query) => (qloo: QlooClient) => qloo.search({ query })),
  );
  const acts = typed.names.map((name, index): ResolvedName => {
    const result = results[index];
    if (!result) return { name, status: "not-checked" };
    const artist = foundOnQloo(name, result.data, tagWeights);
    if (!artist) return { name, status: "not-found" };
    return {
      name,
      status: headlinerIds.has(artist.entityId) ? "headliner" : "found",
      artist,
    };
  });
  return {
    acts,
    repeats: typed.repeats,
    calls: results.flatMap((result) => (result ? [result.call] : [])),
  };
}

/** A venue the build read, as the shortlist names it. */
export interface AnchorVenue {
  entityId: string;
  name: string;
}

/** A saved build's anchor venues, each once, in the order it lists them: Mid's, then Opener's. */
export function anchorVenues(context: BuildContext): AnchorVenue[] {
  const venues = new Map<string, AnchorVenue>();
  for (const band of FEE_BAND_IDS)
    for (const { entityId, name } of context.anchors[band] ?? [])
      if (!venues.has(entityId)) venues.set(entityId, { entityId, name });
  return [...venues.values()];
}

/** A venue's part in a check: read or not, whether Qloo had fan data for it, the acts it lifts. */
export interface RankedVenue {
  venue: AnchorVenue;
  /** Its call answered, from Qloo or the cache. */
  read: boolean;
  /** Its answer was the headliners' own, act for act and score for score. */
  noFanData: boolean;
  /** The acts whose best place comes with this venue's fans, above their place alone. */
  lifts: number;
}

/**
 * Step 2: from the town's saved build (its headliners, anchor venues and crowd age), one
 * /v2/insights call for the headliners alone and one per anchor venue, the headliners plus that
 * venue, each limited to the shortlist (filter.results.entities) so every act is scored inside
 * the same call. Places are read within each call; a venue whose answer is the headliners' own
 * is one Qloo had no fan data for, and lifts nobody.
 */
export async function rankShortlist({
  build,
  artists,
  budget,
}: {
  build: Pick<SavedBuild, "context">;
  /** The acts found on Qloo, in the buyer's order. */
  artists: readonly Pick<QlooEntity, "entityId">[];
  budget: CallBudget;
}): Promise<{
  /** The headliners-alone call answered. */
  ranked: boolean;
  climbs: Map<string, Climb>;
  venues: RankedVenue[];
  /** The calls answered, in order, each with its venue (null for the headliners alone). */
  calls: { call: QlooCall; venue: AnchorVenue | null }[];
}> {
  const { context } = build;
  const headliners = context.headliners.map((headliner) => headliner.entityId);
  // Sorted, so the same acts pasted in any order share one cached answer.
  const among = [...new Set(artists.map((artist) => artist.entityId))].sort();
  const venues = anchorVenues(context);
  if (among.length === 0)
    return {
      ranked: false,
      climbs: new Map(),
      venues: venues.map((venue) => ({
        venue,
        read: false,
        noFanData: false,
        lifts: 0,
      })),
      calls: [],
    };
  const ask = (venueId?: string) => (qloo: QlooClient) =>
    qloo.rankAmong({
      signalEntityIds: venueId ? [...headliners, venueId] : headliners,
      amongIds: among,
      ages: context.ages ?? [],
    });
  const [alone, ...withVenue] = await budget.run([
    ask(),
    ...venues.map((venue) => ask(venue.entityId)),
  ]);
  const noFanData = withVenue.map((answer) =>
    Boolean(alone && answer && sameAnswer(alone.data, answer.data)),
  );
  const usable: VenuePlaces[] = venues.flatMap((venue, index) => {
    const answer = withVenue[index];
    return answer && !noFanData[index]
      ? [{ venueId: venue.entityId, places: placesIn(answer.data) }]
      : [];
  });
  const alonePlaces = alone ? placesIn(alone.data) : new Map<string, number>();
  const climbs = new Map(
    among.map((entityId) => [entityId, climbOf(entityId, alonePlaces, usable)]),
  );
  const lifted = (venueId: string) =>
    [...climbs.values()].filter(
      ({ best, climb }) =>
        climb !== null && climb > 0 && best?.venueId === venueId,
    ).length;
  return {
    ranked: alone !== null,
    climbs,
    venues: venues.map((venue, index) => ({
      venue,
      read: withVenue[index] !== null,
      noFanData: noFanData[index],
      lifts: lifted(venue.entityId),
    })),
    calls: [alone, ...withVenue].flatMap((answer, index) =>
      answer ? [{ call: answer.call, venue: venues[index - 1] ?? null }] : [],
    ),
  };
}

/** A Qloo call as the trace lists it (src/components/trace-panel.tsx), entity ids as names. */
function traceCall(
  call: QlooCall,
  n: number,
  tool: string,
  summary: string,
  names: ReadonlyMap<string, string>,
): TraceCall {
  return {
    n,
    tool,
    endpoint: call.path,
    summary,
    params: call.params.map(([key, value]) => ({
      key,
      value: value
        .split(",")
        .map((part) => names.get(part) ?? part)
        .join(", "),
    })),
    resultCount: call.resultCount,
    ms: call.ms,
    cached: call.cached,
    ...(call.retried ? { retried: call.retried } : {}),
  };
}

const actsWord = (count: number) => (count === 1 ? "act" : "acts");

/**
 * Step 3: a check from start to end. The names are resolved (step 1) and ranked against the
 * town's saved build (step 2); each found act gets its fee range and genre fit the way pickTests
 * reads them, its rows sorted by climb, and every call is listed as the trace lists a build's.
 */
export async function checkShortlist({
  festival,
  build,
  names,
  budget,
}: {
  festival: Festival;
  build: Pick<SavedBuild, "context" | "lineup">;
  names: readonly string[];
  budget: CallBudget;
}): Promise<Shortlist> {
  const { context } = build;
  const resolved = await resolveNames({
    names,
    budget,
    headlinerIds: new Set(context.headliners.map((h) => h.entityId)),
    tagWeights: headlinerTagWeights({
      bands: [],
      headliners: context.headliners,
      comparedTags: context.comparedTags,
      baselines: {},
      venueRuns: [],
    }),
  });
  const found = resolved.acts.flatMap((act) =>
    act.status === "found" ? [act.artist] : [],
  );
  const ranked = await rankShortlist({ build, artists: found, budget });

  // The fee range and the genres, as the booking rule reads them (pickTests, sharedTags).
  const input: AssemblyInput = {
    bands: festival.feeBands,
    headliners: context.headliners,
    comparedTags: context.comparedTags,
    baselines: {},
    venueRuns: [],
  };
  const weights = headlinerTagWeights(input);
  const acts = resolved.acts.map((act): ShortlistAct => {
    if (act.status === "not-found" || act.status === "not-checked")
      return { name: act.name, status: act.status };
    if (act.status === "headliner")
      return { name: act.name, status: "headliner", qlooName: act.artist.name };
    const { artist } = act;
    return {
      name: act.name,
      status: "found",
      entityId: artist.entityId,
      qlooName: artist.name,
      popularity: artist.popularity,
      range: pickTests(input, artist).range,
      band: feeBandFor(artist.popularity, festival.feeBands)?.id ?? null,
      genres: sharedTags(artist, weights).map((tag) => tag.name),
      ...(ranked.climbs.get(artist.entityId) ?? {
        alone: null,
        best: null,
        climb: null,
      }),
    };
  });

  const labels = new Map<string, string>([
    ...context.headliners.map((h): [string, string] => [h.entityId, h.name]),
    ...ranked.venues.map(({ venue }): [string, string] => [
      venue.entityId,
      venue.name,
    ]),
    ...found.map((artist): [string, string] => [artist.entityId, artist.name]),
  ]);
  const count = `Your ${found.length} ${actsWord(found.length)} ranked`;
  const calls = [
    ...resolved.calls.map((call) => ({
      call,
      tool: "shortlist_search",
      summary: `Search for "${call.params.find(([key]) => key === "query")?.[1] ?? ""}"`,
    })),
    ...ranked.calls.map(({ call, venue }) => ({
      call,
      tool: "shortlist_rank",
      summary: venue
        ? `${count} with ${venue.name}'s fans added`
        : `${count} for the headliners' fans alone`,
    })),
  ].map(({ call, tool, summary }, index) =>
    traceCall(call, index + 1, tool, summary, labels),
  );

  const hues = venueHues(
    ranked.venues.map(({ venue }) => venue),
    build.lineup.acts,
  );
  return {
    festivalId: festival.id,
    city: festival.city,
    headliners: context.headliners.map((headliner) => headliner.name),
    ranked: ranked.ranked,
    acts: sortShortlist(acts),
    venues: ranked.venues.map(({ venue, read, noFanData, lifts }) => ({
      entityId: venue.entityId,
      name: venue.name,
      hue: noFanData ? null : (hues.get(venue.entityId) ?? null),
      read,
      noFanData,
      lifts,
    })),
    repeats: resolved.repeats,
    calls,
    made: budget.made(),
    cap: budget.cap,
  };
}

/** The clients a check runs on: one that may call Qloo, and one that reads the cache only. */
export interface ShortlistClients {
  live: QlooClient;
  cached: QlooClient;
}

/** POST /api/shortlist's body: a checked town's festival id and the names as pasted. */
export const ShortlistRequestSchema = z.object({
  festival: z.string().min(1).max(120),
  names: z.array(z.string().max(200)).max(50),
});

const answer = (
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });

/**
 * POST /api/shortlist (WS4, step 4): one check of up to 10 names against a checked town's
 * saved build, at most 14 Qloo calls, limited per IP and per day like a live build with the
 * limiter's own message. A request it refuses never reaches the limiter or Qloo.
 */
export async function handleShortlist({
  body,
  store,
  clients,
  limiter,
  ip,
}: {
  body: unknown;
  store: Pick<BuildStore, "latest">;
  clients: () => Promise<ShortlistClients | null>;
  limiter: RateLimiter;
  ip: string;
}): Promise<Response> {
  const request = ShortlistRequestSchema.safeParse(body);
  if (!request.success)
    return answer({ error: "That shortlist request isn't valid." }, 400);
  const festival = festivalById(request.data.festival);
  if (!festival)
    return answer(
      { error: "Pick one of the towns Undercard has already read." },
      400,
    );
  const { names } = distinctNames(request.data.names);
  if (names.length === 0)
    return answer(
      {
        error: "Paste at least one act's name, one per line.",
        code: "no-names",
      },
      400,
    );
  if (names.length > SHORTLIST_MAX_NAMES)
    return answer(
      {
        error: `Paste at most ${SHORTLIST_MAX_NAMES} names: this list has ${names.length}.`,
        code: "too-many",
      },
      400,
    );
  const build = await store.latest(festival.id);
  if (!build || build.festivalId !== festival.id)
    return answer(
      {
        error: `Undercard has no saved build for ${festival.city} yet, so it has no venues to read there.`,
        code: "no-saved-build",
      },
      404,
    );
  const qloo = await clients();
  if (!qloo)
    return answer({ error: "Qloo isn't configured on this server." }, 503);
  const verdict = await limiter.check("shortlist", ip);
  if (!verdict.allowed)
    return answer({ error: verdict.message, code: "limit" }, 429, {
      "retry-after": String(verdict.retryAfterSeconds),
    });
  try {
    const shortlist = await checkShortlist({
      festival,
      build,
      names,
      budget: callBudget({ ...qloo, cap: SHORTLIST_CALL_CAP }),
    });
    return answer({ shortlist }, 200);
  } catch (error) {
    if (!(error instanceof QlooError)) throw error;
    return answer(
      {
        error:
          error instanceof QlooBusy
            ? error.message
            : "Qloo didn't answer the check. Try again in a minute.",
        code: "qloo-busy",
      },
      503,
    );
  }
}

let syntheticCache: QlooCache | null = null;

/**
 * The server's clients for a check: Qloo through the shared cache, null without a key. In
 * synthetic mode (local e2e runs), the invented answers of tests/e2e/synthetic-build.ts on a
 * memory cache of their own, so a check never reaches the network or the seeded cache.
 */
export async function serverShortlistClients(): Promise<ShortlistClients | null> {
  if (syntheticMode()) {
    const { syntheticShortlistQloo } =
      await import("../../tests/e2e/synthetic-build");
    const cache = (syntheticCache ??= createMemoryCache());
    return {
      live: createQlooClient({
        apiKey: "synthetic",
        cache,
        fetch: async (input) =>
          Response.json(syntheticShortlistQloo(new URL(String(input)))),
      }),
      cached: createQlooClient({ apiKey: "", cache, cacheOnly: true }),
    };
  }
  const live = serverQloo();
  const cached = serverCachedQloo();
  return live && cached ? { live, cached } : null;
}

/** The most insights calls computing Boise's example may make: the headliners and 3 venues. */
export const EXAMPLE_INSIGHTS_CALLS = 4;

/** A client that answers from the cache only; its fetch throws, so it can never call Qloo. */
function cacheReader(cache: QlooCache): QlooClient {
  return createQlooClient({
    apiKey: "",
    cache,
    cacheOnly: true,
    fetch: async () => {
      throw new Error("The shortlist's example reads the Qloo cache only.");
    },
  });
}

/** The example's names: the model's own picks from the festival's saved Without Qloo answer. */
async function examplePicks(festival: Festival, cache: QlooCache) {
  const answer = await savedLlmOnly(festival, cache);
  return answer ? answer.picks.map((pick) => pick.name) : null;
}

/**
 * Step 5: the page's example, the model's own ten picks from the festival's saved Without Qloo
 * answer, checked against its saved build from the Qloo cache alone: a cache-only client whose
 * fetch throws, so the page never calls Qloo or the model. A pick whose search the cache doesn't
 * hold reads "not checked". Until the cache holds the example's rankings, the picks come without
 * rows; with no saved answer there is no example.
 */
export async function shortlistExample({
  festival,
  cache,
  store = createBuildStore(cache),
}: {
  festival: Festival;
  cache: QlooCache;
  store?: Pick<BuildStore, "latest">;
}): Promise<ShortlistExample | null> {
  const names = await examplePicks(festival, cache);
  if (!names) return null;
  const build = await store.latest(festival.id);
  if (!build || build.festivalId !== festival.id)
    return { festivalId: festival.id, names, shortlist: null };
  const reader = cacheReader(cache);
  const shortlist = await checkShortlist({
    festival,
    build,
    names,
    budget: callBudget({
      live: reader,
      cached: reader,
      cap: SHORTLIST_CALL_CAP,
    }),
  });
  const found = shortlist.acts.some((act) => act.status === "found");
  const complete =
    !found ||
    (shortlist.ranked && shortlist.venues.every((venue) => venue.read));
  return {
    festivalId: festival.id,
    names,
    shortlist: complete ? shortlist : null,
  };
}

/**
 * What scripts/shortlist-example.ts runs (and the synthetic server's seed, on invented answers):
 * the example's check through the app's cached client on `cache`, so the page then reads it from
 * the cache alone. The picks' searches come from the cache only (the client refuses to search);
 * the insights calls (one for the headliners alone, one per anchor venue) may reach Qloo, at most
 * `maxInsights` distinct ones, a retry of one being the same call. No model call.
 */
export async function writeShortlistExample({
  festival,
  cache,
  store = createBuildStore(cache),
  apiKey,
  fetch,
  maxInsights = EXAMPLE_INSIGHTS_CALLS,
}: {
  festival: Festival;
  cache: QlooCache;
  store?: Pick<BuildStore, "latest">;
  apiKey: string;
  fetch: typeof globalThis.fetch;
  maxInsights?: number;
}): Promise<{ shortlist: Shortlist; insightsCalls: number; attempts: number }> {
  const names = await examplePicks(festival, cache);
  if (!names)
    throw new Error(`${festival.city} has no saved Without Qloo answer.`);
  const build = await store.latest(festival.id);
  if (!build || build.festivalId !== festival.id)
    throw new Error(`${festival.city} has no saved build.`);
  const insights = new Set<string>();
  let attempts = 0;
  const live = createQlooClient({
    apiKey,
    cache,
    fetch: async (input, init) => {
      const url = new URL(String(input));
      // The picks' searches are in the cache already; one that isn't stays "not checked".
      if (url.pathname !== "/v2/insights") throw new QlooCacheMiss();
      insights.add(url.toString());
      if (insights.size > maxInsights)
        throw new Error(`over the ${maxInsights} insights calls approved`);
      attempts++;
      return fetch(input, init);
    },
  });
  const shortlist = await checkShortlist({
    festival,
    build,
    names,
    budget: callBudget({
      live,
      cached: cacheReader(cache),
      cap: SHORTLIST_CALL_CAP,
    }),
  });
  return { shortlist, insightsCalls: insights.size, attempts };
}
