import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { liftsOver, MIN_LIFT } from "@/lib/assemble-lineup";
import { ageBuckets } from "@/lib/ages";
import type { BuildEvent } from "@/lib/build-events";
import { FEE_BAND_IDS, type FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import {
  QlooBusy,
  QlooError,
  type QlooCall,
  type QlooClient,
  type QlooEntity,
  type QlooResult,
  type QlooTag,
} from "./qloo";

/** The most Qloo calls one build may make (SPEC.md, M2). Cached answers count too. */
export const QLOO_CALL_CAP = 12;

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
  venueRuns: { venue: QlooEntity; band: FeeBandId; artists: QlooEntity[] }[];
  finished: { anchorVenueIds: string[]; summary: string } | null;
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
    }),
  },
  {
    name: "finish",
    description:
      "End the build once both bands have a baseline and venue runs. The app then books the acts each venue lifts most. Not a Qloo call.",
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
  }),
  finish: z.object({
    anchor_venue_ids: z.array(z.string()),
    summary: z.string(),
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

const round = (value: number) => Math.round(value * 100) / 100;
const PLACE_KIND = /:(category|genre):place:/;

export function createToolbox({
  festival,
  qloo,
  emit,
  cap = QLOO_CALL_CAP,
}: {
  festival: Festival;
  qloo: QlooClient;
  emit: (event: BuildEvent) => void;
  cap?: number;
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
    finished: null,
  };
  const names = new Map<string, string>();
  const tagNames = new Map<string, string>();
  let used = 0;

  const bandLabel = (band: FeeBandId) =>
    festival.feeBands.find((entry) => entry.id === band)?.label ?? band;

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

  // Entity ids in a parameter value read better as names in the trace panel.
  const readable = (value: string) =>
    value
      .split(",")
      .map((part) => names.get(part) ?? part)
      .join(", ");

  async function callQloo<T>(
    tool: string,
    endpoint: string,
    summary: string,
    request: () => Promise<QlooResult<T>>,
  ) {
    if (used >= cap)
      throw new BudgetSpent(
        `The Qloo call budget is spent (${cap} of ${cap}). Call finish now.`,
      );
    const n = ++used;
    const started = Date.now();
    try {
      const { data, call } = await request();
      emit({ type: "call", call: traceOf(n, tool, summary, call) });
      return data;
    } catch (error) {
      const message = describeFailure(error);
      console.error(`[undercard] ${tool} (${endpoint}) failed: ${message}`);
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
          error: message,
        },
      });
      // Qloo stayed busy past the build's budget: the whole build stops, not just this tool.
      if (error instanceof QlooBusy) throw error;
      throw new ToolMisuse(message);
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
      const label = tagNames.get(tag_id) ?? tag_id;
      const venues = await callQloo(
        "find_venues",
        "/v2/insights",
        `${festival.city} places tagged ${label}`,
        () => qloo.places({ locationQuery: festival.city, tagId: tag_id }),
      );
      state.venues = venues;
      for (const venue of venues) names.set(venue.entityId, venue.name);
      return {
        city: festival.city,
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
      return {
        band,
        count: artists.length,
        top_acts: artists.slice(0, 8).map((artist) => artist.name),
      };
    },

    async venue_artists({ band, venue_id }) {
      const pair = headlinerPair();
      const venue = state.venues.find(
        (candidate) => candidate.entityId === venue_id,
      );
      if (!venue)
        throw new ToolMisuse(
          `Unknown venue ${venue_id}: pick an entity_id from find_venues.`,
        );
      const range = festival.feeBands.find((entry) => entry.id === band)!;
      const artists = await callQloo(
        "venue_artists",
        "/v2/insights",
        `${bandLabel(band)}-band artists for the headliners and ${venue.name}${ageNote}`,
        () =>
          qloo.artists({
            signalEntityIds: [
              ...pair.map((headliner) => headliner.entityId),
              venue.entityId,
            ],
            popularityMin: range.minPopularity,
            popularityMax: range.maxPopularity,
            excludeEntityIds: pair.map((headliner) => headliner.entityId),
            ages: crowd.buckets,
          }),
      );
      state.venueRuns.push({ venue, band, artists });
      const baseline = state.baselines[band];
      if (!baseline)
        return {
          band,
          venue: venue.name,
          count: artists.length,
          note: "Fetch this band's baseline to measure the lift.",
        };
      const lifted = liftsOver(baseline, artists).filter(
        (entry) => entry.lift >= MIN_LIFT,
      );
      return {
        band,
        venue: venue.name,
        count: artists.length,
        acts_lifted_5_or_more_places: lifted.length,
        top_lifted: lifted.slice(0, 6).map((entry) => entry.artist.name),
      };
    },

    async finish({ anchor_venue_ids, summary }) {
      state.finished = { anchorVenueIds: anchor_venue_ids, summary };
      return { status: "Assembling the board." };
    },
  };

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

  return { tools: AGENT_TOOLS, run, state, callsUsed: () => used, cap };
}

export type Toolbox = ReturnType<typeof createToolbox>;
