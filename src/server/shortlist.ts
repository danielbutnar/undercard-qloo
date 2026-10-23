import { FEE_BAND_IDS } from "@/lib/fee-bands";
import { foundOnQloo } from "@/lib/pick-tests";
import {
  climbOf,
  distinctNames,
  placesIn,
  sameAnswer,
  type Climb,
  type Repeat,
  type VenuePlaces,
} from "@/lib/shortlist";
import type { BuildContext, SavedBuild } from "./build-store";
import {
  QlooCacheMiss,
  type QlooCall,
  type QlooClient,
  type QlooEntity,
  type QlooResult,
} from "./qloo";

/** One Qloo call a check may make, run against the client the budget gives it. */
export type ShortlistTask<T extends unknown[]> = (
  qloo: QlooClient,
) => Promise<QlooResult<T>>;

/**
 * A check's Qloo calls (WS4): each runs through the live client, and a call the server's Qloo
 * cache answers still lists, marked cached. A cache-only client's miss is a call not made: its
 * result is null. `made` counts the calls that reached Qloo.
 */
export function callBudget({
  live,
}: {
  /** Calls that may reach Qloo go here (cache first, as every client reads). */
  live: QlooClient;
  /** Reads the cache only, never Qloo. */
  cached: QlooClient;
  /** The most calls one check may make. */
  cap: number;
}) {
  let made = 0;
  return {
    async run<T extends unknown[]>(
      tasks: readonly ShortlistTask<T>[],
    ): Promise<(QlooResult<T> | null)[]> {
      const results = await Promise.all(
        tasks.map(async (task) => {
          try {
            return await task(live);
          } catch (error) {
            if (error instanceof QlooCacheMiss) return null;
            throw error;
          }
        }),
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
  | { name: string; status: "found" | "headliner"; artist: QlooEntity }
  | { name: string; status: "not-found" | "not-checked" };

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
}: {
  names: readonly string[];
  budget: CallBudget;
  headlinerIds: ReadonlySet<string>;
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
    const artist = foundOnQloo(name, result.data);
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
  calls: QlooCall[];
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
    calls: [alone, ...withVenue].flatMap((answer) =>
      answer ? [answer.call] : [],
    ),
  };
}
