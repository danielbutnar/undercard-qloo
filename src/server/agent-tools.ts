import { climbAfter, climbBaseline } from "@/lib/lift-climb";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  assembleLineup,
  headlinerTagWeights,
  liftsOver,
  LOCAL_LIFT_BAR,
  MIN_LIFT,
  type AssemblyInput,
  type ControlRef,
} from "@/lib/assemble-lineup";
import { ageBuckets } from "@/lib/ages";
import type { BuildEvent, TraceCall } from "@/lib/build-events";
import {
  controlCandidates,
  localLift,
  noFanData as fanless,
} from "@/lib/control-venue";
import { controlTownFor } from "@/lib/control-town";
import { QLOO_CALL_CAP } from "@/lib/agent-limits";
import { refusedLine, skippedLine } from "@/lib/agent-words";
import { FEE_BAND_IDS, type FeeBand, type FeeBandId } from "@/lib/fee-bands";
import { roomKind } from "@/lib/place-kinds";
import {
  needsFullName,
  placesInRegion,
  resolvedName,
} from "@/lib/town-resolution";
import type { Festival } from "@/lib/festival";
import type { Act, LocationReading } from "@/lib/lineup";
import { localPickOf, type LocalPick } from "@/lib/local-pick";
import { foldAccents, foundOnQloo, hasNonAscii } from "@/lib/pick-tests";
import {
  QLOO_RETRY,
  QlooBusy,
  QlooCacheMiss,
  QlooError,
  type QlooCall,
  type QlooClient,
  type QlooEntity,
  type QlooResult,
  type QlooTag,
  type ScoredArtists,
} from "./qloo";

/** The most Qloo calls one build may make, cached answers included (src/lib/agent-limits.ts). */
export { QLOO_CALL_CAP };

/**
 * The agent's own retry (Daniel, 2026-10-28, 19:20): only for a call the client didn't retry (a
 * 4xx, a network error, a timeout), once, after this wait, never at once.
 */
export const RETRY_WAIT_MS = { min: 1_000, max: 2_000 } as const;

/** The agent's retry's wait and clock; tests make them instant. */
export interface RetryTiming {
  sleep: (ms: number) => Promise<void>;
  clock: () => number;
  random: () => number;
}
const REAL_TIMING: RetryTiming = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  clock: Date.now,
  random: Math.random,
};

/** Why the planner says it stopped (WS13.2), in finish's input. */
export const STOP_CLAIMS = [
  "every_band_full",
  "tried_every_music_room",
] as const;
export type StopClaim = (typeof STOP_CLAIMS)[number];

export interface ToolOutcome {
  content: string;
  isError: boolean;
}

export interface AgentState {
  /** Resolved headliners, keyed by the festival's headliner name in lower case. */
  headliners: Map<string, QlooEntity>;
  venues: QlooEntity[];
  comparedTags: { tag: QlooTag; score: number }[];
  baselines: Partial<Record<FeeBandId, QlooEntity[]>>;
  /** A run's venue carries kind when it isn't a club (M6l), a label for the card and the trace. */
  venueRuns: {
    venue: QlooEntity & { kind?: string };
    band: FeeBandId;
    artists: QlooEntity[];
    /**
     * Its matched control abroad and the control's ranking for the tier (WS13.3); null when no
     * room in the control town had fan data. Absent on a venue Qloo had no fan data for.
     */
    control?: { venue: ControlRef; artists: QlooEntity[] } | null;
  }[];
  /** Venues Qloo had no fan data for (WS13.1), by entity id: never read again. */
  noFanData: Set<string>;
  /** The AI's local picks Qloo's search found (WS13.5): for the buyer to check, never booked. */
  localPicks: LocalPick[];
  /** Venues a call that failed twice left unchecked, in order (Daniel, 2026-10-28). */
  unchecked: string[];
  /** Places find_venues listed that the planner named as not music venues, by entity id. */
  notMusic: Set<string>;
  finished: {
    anchorVenueIds: string[];
    summary: string;
    /** Why the planner says it stopped (WS13.2); absent from older scripted plans. */
    stoppedBecause?: StopClaim;
  } | null;
}

const objectSchema = (
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});
const bandProperty = {
  type: "string",
  enum: [...FEE_BAND_IDS],
  description: "The fee band: mid or opener.",
};

/** One tool per Qloo call, plus finish. Strict schemas keep the model's inputs valid. */
/**
 * Where the prompt's step 6 and the local_pick tool give the tiers' popularity ranges (Daniel,
 * 2026-10-28). Read as is, it points to the brief; tierRanges puts in the festival's own.
 */
export const TIER_RANGES =
  "Qloo popularity within the range the brief gives each tier";

const TIER_WORDS: Record<FeeBandId, string> = {
  mid: "mid-size",
  opener: "opening",
};

/** "Qloo popularity 0.80–0.90 for the mid-size tier or 0.55–0.80 for the opening tier". */
export function tierRanges(bands: readonly FeeBand[]): string {
  const ranges = FEE_BAND_IDS.flatMap((id) =>
    bands
      .filter((band) => band.id === id)
      .map(
        (band) =>
          `${band.minPopularity.toFixed(2)}–${band.maxPopularity.toFixed(2)} for the ${TIER_WORDS[id]} tier`,
      ),
  );
  return `Qloo popularity ${ranges.join(" or ")}`;
}

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_artist",
    description:
      "Look up an artist on Qloo by name (GET /search). Use it once per booked headliner; it returns the best matches with their Qloo entity ids.",
    strict: true,
    input_schema: objectSchema({
      name: { type: "string", description: "The artist's name." },
    }),
  },
  {
    name: "find_tag",
    description:
      "Find Qloo tag ids by keyword (GET /v2/tags), scoped to places or artists. Use it to find the tag Qloo puts on live music venues.",
    strict: true,
    input_schema: objectSchema({
      query: {
        type: "string",
        description: "Keywords, for example: live music venue.",
      },
      entity_type: { type: "string", enum: ["place", "artist"] },
    }),
  },
  {
    name: "find_venues",
    description:
      "List places in the festival's city that carry a tag (GET /v2/insights with filter.type=urn:entity:place). Pass the live music venue tag id. Each venue comes with its Qloo entity id and the kinds of place Qloo files it under.",
    strict: true,
    input_schema: objectSchema({
      tag_id: { type: "string", description: "A tag id from find_tag." },
    }),
  },
  {
    name: "compare_headliners",
    description:
      "Compare the two headliners on Qloo (GET /v2/analysis/compare) to get the taste tags they share. Search both headliners first.",
    strict: true,
    input_schema: objectSchema({}),
  },
  {
    name: "baseline_artists",
    description:
      "Rank artists in one fee band by Qloo affinity to the two headliners alone (GET /v2/insights with filter.type=urn:entity:artist, limited to the band's popularity range). This is the baseline each venue's lift is measured against; fetch it once per band.",
    strict: true,
    input_schema: objectSchema({ band: bandProperty }),
  },
  {
    name: "venue_artists",
    description:
      "Rank artists in one fee band by Qloo affinity to the two headliners plus one anchor venue, which joins signal.interests.entities. Compared with the baseline, it shows which acts that venue's audience lifts. Call it for each chosen venue and band.",
    strict: true,
    input_schema: objectSchema({
      band: bandProperty,
      venue_id: {
        type: "string",
        description: "A venue's entity id from find_venues.",
      },
      why: {
        type: "string",
        description:
          "One line on why you read this venue now: why this room, or which venue it replaces and why.",
      },
    }),
  },
  {
    name: "local_pick",
    description: `Name one or two acts from the festival's town that you know of from your own knowledge and that fit the mid-size or opening tier: ${TIER_RANGES}. Acts based there who would suit this undercard: artists only (bands or solo acts), never a festival, venue, label or scene, by the name they're billed under, never a phrase or a description; each with one line on why. The app searches each on Qloo (GET /search, one Qloo call each) and returns what Qloo knows of it. A local pick is for the buyer to check; it never takes a slot.`,
    strict: true,
    input_schema: objectSchema({
      picks: {
        type: "array",
        description: "One or two acts from the town.",
        items: objectSchema({
          name: {
            type: "string",
            description:
              "The artist's name as billed: a band or a solo act, never a festival, venue, label or scene, and never a phrase or a description.",
          },
          why: {
            type: "string",
            description: "One line on why it suits this undercard.",
          },
        }),
      },
    }),
  },
  {
    name: "finish",
    description:
      "End the build once every band is full, or once you have tried every music venue find_venues listed. The app then books the acts each venue lifts most. Not a Qloo call.",
    strict: true,
    input_schema: objectSchema({
      anchor_venue_ids: {
        type: "array",
        items: { type: "string" },
        description: "The venues you anchored on.",
      },
      summary: {
        type: "string",
        description: "One sentence on the plan you followed.",
      },
      stopped_because: {
        type: "string",
        enum: [...STOP_CLAIMS],
        description:
          "Why you stopped: every band is full, or you tried every music venue find_venues listed.",
      },
      not_music_venues: {
        type: "array",
        items: objectSchema({
          entity_id: {
            type: "string",
            description: "The place's entity_id from find_venues.",
          },
          reason: {
            type: "string",
            description:
              'What the place is, and why you are sure it never hosts concerts, to end the buyer\'s line "Skipped <place>: listed by Qloo, but …", for example "a coffee roaster with no stage, not a music venue".',
          },
        }),
        description:
          "Places find_venues listed that you are sure never host concerts, each with your reason. Judge by what happens there, never because of its name or its food: when in doubt, read the place instead. The buyer sees a line for each.",
      },
    }),
  },
];

const Inputs = {
  search_artist: z.object({ name: z.string().min(1) }),
  find_tag: z.object({
    query: z.string().min(1),
    entity_type: z.enum(["place", "artist"]),
  }),
  find_venues: z.object({ tag_id: z.string().min(1) }),
  compare_headliners: z.object({}),
  baseline_artists: z.object({ band: z.enum(FEE_BAND_IDS) }),
  venue_artists: z.object({
    band: z.enum(FEE_BAND_IDS),
    venue_id: z.string().min(1),
    // Required of the model (strict schema); older scripted plans send none.
    why: z.string().optional(),
  }),
  local_pick: z.object({
    picks: z
      .array(z.object({ name: z.string().min(1), why: z.string() }))
      .min(1)
      .max(2),
  }),
  finish: z.object({
    anchor_venue_ids: z.array(z.string()),
    summary: z.string(),
    stopped_because: z.enum(STOP_CLAIMS).optional(),
    // Required of the model (strict schema); older scripted plans send none.
    not_music_venues: z
      .array(
        z.object({
          entity_id: z.string().min(1),
          // Daniel, 2026-10-28 (19:10): a place is skipped only with the planner's reason.
          reason: z.string().trim().min(1),
        }),
      )
      .optional(),
  }),
};
type ToolName = keyof typeof Inputs;

function describeFailure(error: unknown): string {
  if (error instanceof QlooError) return error.message;
  if (error instanceof z.ZodError)
    return "Qloo answered in a shape the app couldn't read.";
  if (error instanceof Error && error.name === "TimeoutError")
    return "Qloo took too long to answer.";
  return "The Qloo request failed.";
}

class BudgetSpent extends Error {}
class ToolMisuse extends Error {}

const isGenreTag = (type: string) => type.includes("genre");

/** The booking rule's input from what the build has read so far (src/lib/assemble-lineup.ts). */
export function assemblyOf(
  festival: Festival,
  state: AgentState,
): AssemblyInput {
  return {
    bands: festival.feeBands,
    headliners: festival.headliners.flatMap(
      (name) => state.headliners.get(name.toLowerCase()) ?? [],
    ),
    comparedTags: state.comparedTags
      .filter(({ tag }) => isGenreTag(tag.type))
      .map(({ tag, score }) => ({ name: tag.name, score })),
    baselines: state.baselines,
    venueRuns: state.venueRuns.map(({ venue, band, artists, control }) => ({
      venue: {
        entityId: venue.entityId,
        name: venue.name,
        ...(venue.kind ? { kind: venue.kind } : {}),
      },
      band,
      artists,
      ...(control !== undefined ? { control } : {}),
    })),
  };
}

const round = (value: number) => Math.round(value * 100) / 100;
const PLACE_KIND = /:(category|genre):place:/;

export function createToolbox({
  festival,
  qloo,
  emit,
  cap = QLOO_CALL_CAP,
  timing = REAL_TIMING,
}: {
  festival: Festival;
  qloo: QlooClient;
  emit: (event: BuildEvent) => void;
  cap?: number;
  timing?: RetryTiming;
}) {
  // The crowd's age goes to every artist call as Qloo's age buckets.
  const crowd = ageBuckets(festival.crowdAge.min, festival.crowdAge.max);
  const ageNote = crowd.exact
    ? ""
    : " (the crowd's ages as Qloo's nearest buckets)";
  const state: AgentState = {
    headliners: new Map(),
    venues: [],
    comparedTags: [],
    baselines: {},
    venueRuns: [],
    noFanData: new Set(),
    localPicks: [],
    unchecked: [],
    notMusic: new Set(),
    finished: null,
  };
  const names = new Map<string, string>();
  const tagNames = new Map<string, string>();
  let used = 0;
  // Daniel, 2026-10-28 (19:20): every retry counted, the client's included; the agent's own
  // retries stop where the client's do, QLOO_RETRY.budgetMs into the run, so retries never take
  // it past the route's 120 s.
  let retries = 0;
  let busy = false;
  const retryDeadline = timing.clock() + QLOO_RETRY.budgetMs;

  const bandLabel = (band: FeeBandId) =>
    festival.feeBands.find((entry) => entry.id === band)?.label ?? band;

  // WS13.3: the control town (section 37's rule) and its rooms, listed once when first needed;
  // the rooms Qloo had no fan data for; each room's ranking per tier, read once.
  const controlTown = controlTownFor(festival);
  let venueTag: string | null = null;
  let controlRooms: Promise<QlooEntity[]> | null = null;
  const controlsWithout = new Set<string>();
  const controlRankings = new Map<string, Promise<ScoredArtists>>();

  function roomsAbroad(venue: string): Promise<QlooEntity[]> {
    if (!controlTown || !venueTag) return Promise.resolve([]);
    const tag = venueTag;
    const town = controlTown;
    const label = tagNames.get(tag) ?? tag;
    // As find_venues reads a town (M6j): the plain name, then "town, region" when it misses.
    controlRooms ??= (async () => {
      const summary = `${town.city} places tagged ${label}, to find each venue's control: a room in ${town.city} with similar Qloo popularity`;
      const plain = await callQloo(
        "control_venues",
        "/v2/insights",
        summary,
        () => qloo.places({ locationQuery: town.city, tagId: tag }),
        undefined,
        undefined,
        { unchecked: venue, short: true },
      );
      if (!needsFullName(plain, town.region)) return plain;
      const fullName = `${town.city}, ${town.region}`;
      const full = await callQloo(
        "control_venues",
        "/v2/insights",
        `${summary}, asked again as “${fullName}”`,
        () => qloo.places({ locationQuery: fullName, tagId: tag }),
        undefined,
        undefined,
        { unchecked: venue, short: true },
      );
      return placesInRegion([plain, full], town.region).places;
    })();
    return controlRooms;
  }

  /**
   * The venue's matched control for a tier (WS13.3, Daniel's rule): the control town's room
   * closest in Qloo popularity, ties by name, skipping a room Qloo has no fan data for (its
   * warning, or a ranking that is the headliners' own); null when none has fan data, or the
   * calls run out. Each room's ranking for a tier is read once, whichever venue asks for it.
   */
  async function matchedControl(
    venue: QlooEntity,
    band: FeeBandId,
    headliners: string[],
  ): Promise<{ venue: ControlRef; artists: QlooEntity[] } | null> {
    if (!controlTown) return null;
    let rooms: QlooEntity[];
    try {
      rooms = await roomsAbroad(venue.name);
    } catch (error) {
      if (error instanceof QlooBusy) throw error;
      // The control town's search failed twice: this venue wasn't checked (Daniel, 14:10).
      if (
        !(error instanceof BudgetSpent) &&
        !state.unchecked.includes(venue.name)
      )
        state.unchecked.push(venue.name);
      return null;
    }
    const range = festival.feeBands.find((entry) => entry.id === band)!;
    const baseline = state.baselines[band];
    for (const room of controlCandidates(rooms, venue.popularity)) {
      if (controlsWithout.has(room.entityId)) continue;
      const key = `${room.entityId}|${band}`;
      let answer: ScoredArtists;
      try {
        if (!controlRankings.has(key))
          controlRankings.set(
            key,
            callQloo(
              "control_artists",
              "/v2/insights",
              `${bandLabel(band)}-band artists for the headliners and ${room.name}, a room in ${controlTown.city} with similar Qloo popularity, the control for ${venue.name}${ageNote}`,
              () =>
                qloo.scoredArtists({
                  signalEntityIds: [...headliners, room.entityId],
                  popularityMin: range.minPopularity,
                  popularityMax: range.maxPopularity,
                  excludeEntityIds: headliners,
                  ages: crowd.buckets,
                }),
              undefined,
              (data) => ({
                controlFor: venue.name,
                ...(fanless({
                  warned: data.unscored.includes(room.entityId),
                  ranking: data.entities,
                  without: baseline ?? [],
                })
                  ? { noFanData: room.name }
                  : {}),
              }),
              { unchecked: venue.name, short: true },
            ),
          );
        answer = await controlRankings.get(key)!;
      } catch (error) {
        if (error instanceof QlooBusy) throw error;
        // The cap is spent: no control. A call that failed twice: this venue wasn't checked, and
        // its line says so (Daniel, 2026-10-28), never a silent "no control".
        if (
          !(error instanceof BudgetSpent) &&
          !state.unchecked.includes(venue.name)
        )
          state.unchecked.push(venue.name);
        return null;
      }
      if (
        fanless({
          warned: answer.unscored.includes(room.entityId),
          ranking: answer.entities,
          without: baseline ?? [],
        })
      ) {
        controlsWithout.add(room.entityId);
        continue;
      }
      names.set(room.entityId, room.name);
      return {
        venue: {
          entityId: room.entityId,
          name: room.name,
          town: controlTown.city,
        },
        artists: answer.entities,
      };
    }
    return null;
  }

  /**
   * The music venues read so far (Daniel, 2026-10-28): how many had fan data, how many of those
   * were read with their control (only these count toward the two the agent reads before it may
   * stop), and the listed places not yet tried: neither read, nor known to have no fan data, nor
   * left unchecked by a failed call, nor named by the planner as not a music venue.
   */
  function roomsRead() {
    const fanData = new Set<string>();
    const controlled = new Set<string>();
    for (const run of state.venueRuns) {
      if (run.control === undefined) continue;
      fanData.add(run.venue.entityId);
      if (run.control) controlled.add(run.venue.entityId);
    }
    const untried = state.venues.filter(
      (venue) =>
        !state.venueRuns.some((run) => run.venue.entityId === venue.entityId) &&
        !state.noFanData.has(venue.entityId) &&
        !state.unchecked.includes(venue.name) &&
        !state.notMusic.has(venue.entityId),
    );
    return { fanData: fanData.size, controlled: controlled.size, untried };
  }

  /**
   * Why the planner may not stop yet (Daniel, 2026-10-28): fewer than two music venues with fan
   * data read with their controls, while a listed place is untried and the cap leaves room for a
   * venue and its control. Null when it may stop.
   */
  function refuseStop(): string | null {
    const { controlled, untried } = roomsRead();
    if (controlled >= 2 || untried.length === 0 || cap - used < 2) return null;
    const names = untried.map((venue) => venue.name);
    // Daniel, 2026-10-28 (19:20): each refusal is a decision line of the run, saved and replayed,
    // so the comparison can count them.
    emit({
      type: "status",
      text: refusedLine(controlled, names),
      planner: true,
    });
    return `Read at least two music venues with fan data, each with its control, before you finish: ${controlled} so far. Not tried yet: ${names.join(", ")}. Read the next of them. Name one in not_music_venues, with your reason, only if you are sure it never hosts concerts, never because of its name or its food.`;
  }

  // WS13.2: how full each tier is by the rule, so the planner reads until every one is.
  function progress() {
    const { shortfall } = assembleLineup(assemblyOf(festival, state));
    const tiers = Object.fromEntries(
      festival.feeBands.map((band) => [
        band.id,
        { filled: band.slots - shortfall[band.id], slots: band.slots },
      ]),
    );
    return {
      tiers,
      every_tier_full: festival.feeBands.every(
        (band) => shortfall[band.id] === 0,
      ),
      qloo_calls_left: Math.max(0, cap - used),
    };
  }

  function headlinerPair(): [QlooEntity, QlooEntity] {
    const [a, b] = festival.headliners.map((name) =>
      state.headliners.get(name.toLowerCase()),
    );
    if (!a || !b)
      throw new ToolMisuse(
        `Search both headliners first: ${festival.headliners.join(" and ")}.`,
      );
    return [a, b];
  }

  // Entity ids in a parameter value read better as names in the trace panel. A value that is
  // already words ("Boise, Idaho") keeps its single spaces.
  const readable = (value: string) =>
    value
      .split(",")
      .map((part) => names.get(part.trim()) ?? part.trim())
      .join(", ");

  async function callQloo<T>(
    tool: string,
    endpoint: string,
    summary: string,
    request: () => Promise<QlooResult<T>>,
    /** A fuller line for the trace, once the answer is in (M6j's resolved place). */
    describe?: (data: T) => string,
    /** What the answer adds to the call's trace line (Qloo had no fan data; the planner's line). */
    mark?: (data: T) => Pick<TraceCall, "noFanData" | "why" | "controlFor">,
    /**
     * What the call leaves unchecked if it fails twice (Daniel, 2026-10-28): its trace line says
     * so, and a venue among them makes the page say the bill may be short.
     */
    failure?: { unchecked: string; short: boolean },
  ) {
    if (used >= cap)
      throw new BudgetSpent(
        `The Qloo call budget is spent (${cap} of ${cap}). Call finish now.`,
      );
    const n = ++used;
    const started = Date.now();
    // Daniel, 2026-10-28 (19:20): the client retries a busy answer (429, 5xx) itself, within its
    // time budget. The agent retries only a call the client didn't (a 4xx, a network error, a
    // timeout), once, after 1-2 s, while the run's retry time lasts. Every retry rides on the
    // call's own line and is counted, the client's included.
    const retried: number[] = [];
    for (let attempt = 0; ; attempt++) {
      try {
        const { data, call } = await request();
        const line = traceOf(
          n,
          tool,
          describe ? describe(data) : summary,
          call,
        );
        const all = [...retried, ...(line.retried ?? [])];
        retries += all.length;
        emit({
          type: "call",
          call: {
            ...line,
            ...(all.length ? { retried: all } : {}),
            ...mark?.(data),
          },
        });
        return data;
      } catch (error) {
        const wait =
          RETRY_WAIT_MS.min +
          Math.round(timing.random() * (RETRY_WAIT_MS.max - RETRY_WAIT_MS.min));
        if (
          attempt === 0 &&
          !(error instanceof QlooBusy) &&
          !(error instanceof QlooCacheMiss) &&
          timing.clock() + wait <= retryDeadline
        ) {
          retried.push(error instanceof QlooError ? error.status : 0);
          await timing.sleep(wait);
          continue;
        }
        const message = describeFailure(error);
        console.error(`[undercard] ${tool} (${endpoint}) failed: ${message}`);
        // A busy answer the client gave up on is a failed call like any other: its venue is
        // unchecked and the bill may be short; it no longer ends the build.
        if (error instanceof QlooBusy) busy = true;
        const all = [
          ...retried,
          ...(error instanceof QlooBusy ? error.retried : []),
        ];
        retries += all.length;
        if (failure?.short && !state.unchecked.includes(failure.unchecked))
          state.unchecked.push(failure.unchecked);
        emit({
          type: "call",
          call: {
            n,
            tool,
            endpoint,
            summary,
            params: [],
            resultCount: null,
            ms: Date.now() - started,
            cached: false,
            ...(all.length ? { retried: all } : {}),
            error: message,
            ...(failure ? { unchecked: failure.unchecked } : {}),
          },
        });
        // A re-run's own stop (its first 429, its window spent) ends the run at once.
        if (error instanceof QlooBusy && error.stopsRun) throw error;
        throw new ToolMisuse(message);
      }
    }
  }

  function traceOf(n: number, tool: string, summary: string, call: QlooCall) {
    return {
      n,
      tool,
      endpoint: call.path,
      summary,
      params: call.params.map(([key, value]) => ({
        key,
        value: readable(value),
      })),
      resultCount: call.resultCount,
      ms: call.ms,
      cached: call.cached,
      ...(call.retried ? { retried: call.retried } : {}),
    };
  }

  const handlers: {
    [K in ToolName]: (input: z.infer<(typeof Inputs)[K]>) => Promise<unknown>;
  } = {
    async search_artist({ name }) {
      const matches = await callQloo(
        "search_artist",
        "/search",
        `Search for "${name}"`,
        () => qloo.search({ query: name }),
      );
      for (const match of matches) names.set(match.entityId, match.name);
      const booked = festival.headliners.find(
        (headliner) => headliner.toLowerCase() === name.toLowerCase(),
      );
      const chosen =
        matches.find(
          (match) => match.name.toLowerCase() === name.toLowerCase(),
        ) ?? matches[0];
      if (booked && chosen) state.headliners.set(booked.toLowerCase(), chosen);
      return {
        matches: matches.slice(0, 3).map((match) => ({
          entity_id: match.entityId,
          name: match.name,
          popularity: round(match.popularity),
        })),
        booked_headliner: booked && chosen ? chosen.name : null,
      };
    },

    async find_tag({ query, entity_type }) {
      const tags = await callQloo(
        "find_tag",
        "/v2/tags",
        `Tags matching "${query}"`,
        () => qloo.tags({ query, parentType: `urn:entity:${entity_type}` }),
      );
      for (const tag of tags) tagNames.set(tag.id, tag.name);
      return { tags: tags.map((tag) => ({ id: tag.id, name: tag.name })) };
    },

    async find_venues({ tag_id }) {
      venueTag = tag_id;
      const label = tagNames.get(tag_id) ?? tag_id;
      const { city, region } = festival;
      const summary = `${city} places tagged ${label}`;
      // A town resolves to its state or country (M6j): the plain name first, as Qloo reads it
      // best; when its places miss the region, once more as "town, region", and the answer
      // with more places in the region stands. The second ask is a real call: it counts.
      const where = (found: QlooEntity[]) => {
        const name = resolvedName(city, found);
        return name ? ` · resolved to ${name}` : "";
      };
      const plain = await callQloo(
        "find_venues",
        "/v2/insights",
        summary,
        () => qloo.places({ locationQuery: city, tagId: tag_id }),
        (found) =>
          needsFullName(found, region) ? summary : `${summary}${where(found)}`,
      );
      const answers = [plain];
      if (needsFullName(plain, region)) {
        const fullName = `${city}, ${region}`;
        answers.push(
          await callQloo(
            "find_venues",
            "/v2/insights",
            `${summary}, asked again as “${fullName}”`,
            () => qloo.places({ locationQuery: fullName, tagId: tag_id }),
            (found) => {
              const chosen = placesInRegion([plain, found], region);
              const outside = chosen.outside
                ? ` · ${chosen.outside} outside ${region} left out`
                : "";
              return `${summary}, asked again as “${fullName}”${where(chosen.places)}${outside}`;
            },
          ),
        );
      }
      const chosen =
        answers.length > 1 || region.trim()
          ? placesInRegion(answers, region)
          : { places: plain, outside: 0, answer: 0 };
      const venues = answers.length > 1 ? chosen.places : plain;
      state.venues = venues;
      for (const venue of venues) names.set(venue.entityId, venue.name);
      return {
        city,
        resolved_to: resolvedName(city, venues),
        venues: venues.map((venue) => ({
          entity_id: venue.entityId,
          name: venue.name,
          kinds: [
            ...new Set(
              venue.tags
                .filter((tag) => PLACE_KIND.test(tag.id))
                .map((tag) => tag.name),
            ),
          ].slice(0, 4),
        })),
      };
    },

    async compare_headliners() {
      const [a, b] = headlinerPair();
      const shared = await callQloo(
        "compare_headliners",
        "/v2/analysis/compare",
        `Taste shared by ${a.name} and ${b.name}`,
        () => qloo.compare({ a: [a.entityId], b: [b.entityId] }),
      );
      state.comparedTags = shared;
      return { shared_tags: shared.slice(0, 12).map(({ tag }) => tag.name) };
    },

    async baseline_artists({ band }) {
      const pair = headlinerPair();
      const range = festival.feeBands.find((entry) => entry.id === band)!;
      const artists = await callQloo(
        "baseline_artists",
        "/v2/insights",
        `${bandLabel(band)}-band artists for the headliners alone${ageNote}`,
        () =>
          qloo.artists({
            signalEntityIds: pair.map((headliner) => headliner.entityId),
            popularityMin: range.minPopularity,
            popularityMax: range.maxPopularity,
            excludeEntityIds: pair.map((headliner) => headliner.entityId),
            ages: crowd.buckets,
          }),
      );
      state.baselines[band] = artists;
      // M9a: the band's list for the headliners alone, the start of the climb.
      emit(climbBaseline(band, artists));
      return {
        band,
        count: artists.length,
        top_acts: artists.slice(0, 8).map((artist) => artist.name),
      };
    },

    async venue_artists({ band, venue_id, why }) {
      const pair = headlinerPair();
      const venue = state.venues.find(
        (candidate) => candidate.entityId === venue_id,
      );
      if (!venue)
        throw new ToolMisuse(
          `Unknown venue ${venue_id}: pick an entity_id from find_venues.`,
        );
      // WS13.1: Qloo's fan data is a venue's, not a tier's (evidence 35: every venue unscored in
      // one fee range was unscored in all), so a venue without it is never read again.
      if (state.noFanData.has(venue.entityId))
        return {
          band,
          venue: venue.name,
          fan_data: false,
          note: `Qloo had no fan data for ${venue.name} on an earlier read, so no call was made. Read the next music venue instead.`,
          ...progress(),
        };
      // A park, arena or stadium is named on its line (M6l); booking doesn't read the label.
      const kind = roomKind(venue.tags, venue.keywords);
      const kindNote = kind ? ` (${kind})` : "";
      const range = festival.feeBands.find((entry) => entry.id === band)!;
      const baseline = state.baselines[band];
      // Qloo's not_found warning names the venue; or, with no warning, its ranking is the
      // headliners' own, act for act (section 37's reading 2, src/lib/control-venue.ts).
      const lacksFanData = (answer: ScoredArtists) =>
        fanless({
          warned: answer.unscored.includes(venue.entityId),
          ranking: answer.entities,
          without: baseline ?? [],
        }) !== null;
      const answer = await callQloo(
        "venue_artists",
        "/v2/insights",
        `${bandLabel(band)}-band artists for the headliners and ${venue.name}${kindNote}${ageNote}`,
        () =>
          qloo.scoredArtists({
            signalEntityIds: [
              ...pair.map((headliner) => headliner.entityId),
              venue.entityId,
            ],
            popularityMin: range.minPopularity,
            popularityMax: range.maxPopularity,
            excludeEntityIds: pair.map((headliner) => headliner.entityId),
            ages: crowd.buckets,
          }),
        undefined,
        (data) => ({
          ...(lacksFanData(data) ? { noFanData: venue.name } : {}),
          ...(why?.trim() ? { why: why.trim() } : {}),
        }),
        { unchecked: venue.name, short: true },
      );
      const artists = answer.entities;
      const noFanData = lacksFanData(answer);
      if (noFanData) state.noFanData.add(venue.entityId);
      if (baseline) emit(climbAfter(band, range, venue, baseline, artists));
      // WS13.3: a venue with fan data is read against its matched control abroad, same tier.
      const control = noFanData
        ? undefined
        : await matchedControl(
            venue,
            band,
            pair.map((headliner) => headliner.entityId),
          );
      state.venueRuns.push({
        venue: kind ? { ...venue, kind } : venue,
        band,
        artists,
        ...(control !== undefined ? { control } : {}),
      });
      if (noFanData)
        return {
          band,
          venue: venue.name,
          fan_data: false,
          note: `Qloo had no fan data for ${venue.name}: it left the venue out of the signal, so this ranking is the headliners' own and lifts no act. Skip ${venue.name} for every tier and read the next music venue in its place.`,
          ...progress(),
        };
      if (!baseline)
        return {
          band,
          venue: venue.name,
          fan_data: true,
          count: artists.length,
          note: "Fetch this band's baseline to measure the lift.",
          ...progress(),
        };
      const lifted = liftsOver(baseline, artists).filter(
        (entry) => entry.lift >= MIN_LIFT,
      );
      const local = control
        ? lifted.filter(
            (entry) =>
              (localLift(entry.artist.entityId, artists, control.artists) ??
                0) >= LOCAL_LIFT_BAR,
          )
        : [];
      return {
        band,
        venue: venue.name,
        fan_data: true,
        count: artists.length,
        acts_lifted_5_or_more_places: lifted.length,
        // Daniel, 2026-10-28: the control is worded as what it is, never "matched".
        control: control
          ? `${control.venue.name}, a room in ${control.venue.town} with similar Qloo popularity`
          : null,
        acts_with_local_lift_5_or_more: local.length,
        top_lifted: local.slice(0, 6).map((entry) => entry.artist.name),
        ...(control
          ? {}
          : {
              note: `No room in ${controlTown?.city ?? "the control town"} with similar Qloo popularity had fan data to serve as ${venue.name}'s control, so its acts can't be booked: read the next music venue.`,
            }),
        ...progress(),
      };
    },

    async local_pick({ picks }) {
      // Searched as search_artist searches, with the accents folded once more when a name
      // with letters beyond ASCII finds nothing (WS8). Only a pick Qloo finds is kept.
      const input = assemblyOf(festival, state);
      // Between two acts of one name, the one the headliners' genres point to (WS13.6).
      const weights = headlinerTagWeights(input);
      const results = [];
      for (const { name, why } of picks) {
        const search = (query: string) =>
          callQloo(
            "local_pick",
            "/search",
            `Search for the AI's local pick "${query}"`,
            () => qloo.search({ query }),
          );
        let found = foundOnQloo(name, await search(name), weights);
        if (!found && hasNonAscii(name))
          found = foundOnQloo(
            foldAccents(name),
            await search(foldAccents(name)),
            weights,
          );
        if (!found) {
          results.push({ name, found: false });
          continue;
        }
        names.set(found.entityId, found.name);
        const pick = localPickOf(input, found, name, why);
        if (!state.localPicks.some((kept) => kept.entityId === pick.entityId))
          state.localPicks.push(pick);
        results.push({
          name: found.name,
          found: true,
          popularity: round(found.popularity),
          tier: pick.band,
        });
      }
      return { picks: results };
    },

    async finish({
      anchor_venue_ids,
      summary,
      stopped_because,
      not_music_venues,
    }) {
      // Daniel, 2026-10-28 (19:10): a place skipped as not a music venue is said, with the
      // planner's reason, as one of its lines: in the trace, saved with the build, replayed.
      for (const { entity_id, reason } of not_music_venues ?? []) {
        const place = state.venues.find(
          (venue) => venue.entityId === entity_id,
        );
        if (!place)
          throw new ToolMisuse(
            `Unknown place ${entity_id} in not_music_venues: pick an entity_id from find_venues.`,
          );
        if (
          state.notMusic.has(entity_id) ||
          state.venueRuns.some((run) => run.venue.entityId === entity_id)
        )
          continue;
        state.notMusic.add(entity_id);
        emit({
          type: "status",
          text: skippedLine(place.name, reason),
          planner: true,
        });
      }
      // Daniel, 2026-10-28: at least two music venues with fan data before the agent may stop.
      const more = refuseStop();
      if (more) throw new ToolMisuse(more);
      // WS13.7: why it stopped, in the planner's own words, is a line of the trace.
      if (summary.trim())
        emit({ type: "status", text: summary.trim(), planner: true });
      state.finished = {
        anchorVenueIds: anchor_venue_ids,
        summary,
        ...(stopped_because ? { stoppedBecause: stopped_because } : {}),
      };
      return { status: "Assembling the board." };
    },
  };

  /**
   * WS13.4: Qloo's location signal as a second reading for the lineup's acts, never the booking
   * basis. Per tier, the tier's acts among themselves for the headliners alone and with
   * signal.location.query set to the town (Qloo scores each call on its own scale, so both read
   * the same acts), as section 34's Control B measured it. Two calls a tier while the cap allows;
   * an act Qloo leaves out of either answer, or a call that fails, gives no reading.
   */
  async function readLocation(
    acts: readonly Act[],
  ): Promise<Map<string, LocationReading>> {
    const readings = new Map<string, LocationReading>();
    const town = festival.region.trim()
      ? `${festival.city}, ${festival.region}`
      : festival.city;
    const pair = festival.headliners.flatMap(
      (name) => state.headliners.get(name.toLowerCase())?.entityId ?? [],
    );
    if (pair.length < 2) return readings;
    for (const band of festival.feeBands) {
      const among = acts
        .filter((act) => act.band === band.id)
        .map((act) => act.entityId);
      if (among.length === 0 || cap - used < 2) continue;
      for (const id of among)
        names.set(id, acts.find((act) => act.entityId === id)!.name);
      const ask = (locationQuery?: string) =>
        callQloo(
          "location_signal",
          "/v2/insights",
          locationQuery
            ? `${bandLabel(band.id)}-band lineup acts for the headliners and Qloo's location signal for ${locationQuery}${ageNote}`
            : `${bandLabel(band.id)}-band lineup acts for the headliners alone, to compare${ageNote}`,
          () =>
            qloo.rankAmong({
              signalEntityIds: pair,
              amongIds: among,
              ages: crowd.buckets,
              ...(locationQuery ? { locationQuery } : {}),
            }),
          undefined,
          undefined,
          {
            unchecked: `the location reading for ${band.id === "mid" ? "mid-size" : "opening"} acts`,
            short: false,
          },
        );
      try {
        const [alone, located] = await Promise.all([ask(), ask(town)]);
        const without = new Map(
          alone.map((artist) => [artist.entityId, artist.affinity]),
        );
        for (const artist of located) {
          const before = without.get(artist.entityId);
          if (
            artist.affinity !== null &&
            before !== null &&
            before !== undefined
          )
            readings.set(artist.entityId, {
              town,
              withSignal: artist.affinity,
              without: before,
            });
        }
      } catch {
        // A second reading only: a failed call leaves the tier without one.
      }
    }
    return readings;
  }

  async function run(name: string, input: unknown): Promise<ToolOutcome> {
    if (!(name in Inputs))
      return { content: `Unknown tool ${name}.`, isError: true };
    const parsed = Inputs[name as ToolName].safeParse(input);
    if (!parsed.success)
      return {
        content: `Invalid input for ${name}: ${parsed.error.message}`,
        isError: true,
      };
    try {
      const handler = handlers[name as ToolName] as (
        value: unknown,
      ) => Promise<unknown>;
      return {
        content: JSON.stringify(await handler(parsed.data)),
        isError: false,
      };
    } catch (error) {
      if (error instanceof BudgetSpent || error instanceof ToolMisuse)
        return { content: error.message, isError: true };
      throw error;
    }
  }

  // Daniel, 2026-10-28: local_pick gives the festival's own tier ranges.
  const tools = AGENT_TOOLS.map((tool) =>
    tool.name === "local_pick" && tool.description
      ? {
          ...tool,
          description: tool.description.replace(
            TIER_RANGES,
            tierRanges(festival.feeBands),
          ),
        }
      : tool,
  );

  return {
    tools,
    run,
    readLocation,
    state,
    callsUsed: () => used,
    /** Retries in the run so far, the client's included (Daniel, 2026-10-28). */
    retriesUsed: () => retries,
    /** Whether a call failed on a busy Qloo the client gave up on. */
    sawBusy: () => busy,
    cap,
    roomsRead,
    refuseStop,
  };
}

export type Toolbox = ReturnType<typeof createToolbox>;
