// Shared test doubles for WS13 (Agent 2.0): a scripted planner, the synthetic Qloo, and
// Sagebrush Sound's brief moved to the invented town of Larkspur, whose venue list holds a music
// room Qloo has no fan data for. Everything here is invented data.
import type Anthropic from "@anthropic-ai/sdk";
import type { BuildEvent, TraceCall } from "@/lib/build-events";
import type { Festival } from "@/lib/festival";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { runUndercardAgent } from "@/server/agent";
import { createToolbox } from "@/server/agent-tools";
import type { AgentModel, AgentTurnRequest } from "@/server/ai";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import {
  fakeFetch,
  LARKSPUR,
  NO_FAN_DATA_VENUE,
  syntheticId,
  syntheticQloo,
} from "../m2/fake-qloo";

export const VENUE_TAG = "urn:tag:genre:place:live_music_venue";
export const LANTERN = syntheticId(201);
export const FORT = syntheticId(202);
export const DINER = syntheticId(203);
export const HALL = syntheticId(NO_FAN_DATA_VENUE.n);
export const HALL_NAME = NO_FAN_DATA_VENUE.name;

/** Sagebrush Sound's brief in Larkspur: same headliners, tiers and crowd. */
export const LARKSPUR_FESTIVAL: Festival = {
  ...SAGEBRUSH_SOUND,
  id: "larkspur-sound",
  city: LARKSPUR,
};

export type ToolCall = { name: string; input: Record<string, unknown> };
export type Turn = ToolCall[] | { text: string; calls?: ToolCall[] };

function message(turn: Turn, index: number): Anthropic.Message {
  const calls = Array.isArray(turn) ? turn : (turn.calls ?? []);
  const text = Array.isArray(turn) ? null : turn.text;
  return {
    id: `msg_synthetic_${index}`,
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: [
      ...(text ? [{ type: "text", text, citations: null }] : []),
      ...calls.map((call, k) => ({
        type: "tool_use",
        id: `toolu_${index}_${k}`,
        name: call.name,
        input: call.input,
      })),
    ],
    stop_reason: calls.length ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  } as unknown as Anthropic.Message;
}

/** A model that plays back fixed turns (then "Done.") and records every request it gets. */
export function scriptedModel(turns: Turn[] | ((index: number) => Turn)) {
  const requests: AgentTurnRequest[] = [];
  const model: AgentModel = {
    async nextTurn(request) {
      const index = requests.length;
      requests.push(structuredClone(request));
      const turn =
        typeof turns === "function"
          ? turns(index)
          : (turns[index] ?? { text: "Done." });
      return message(turn, index);
    },
  };
  return { model, requests };
}

export const read = (band: "mid" | "opener", venue: string): ToolCall => ({
  name: "venue_artists",
  input: { band, venue_id: venue },
});

/** The plan's opening turns: the headliners, the tag, the venues, then compare and baselines. */
export const OPENING: Turn[] = [
  [
    { name: "search_artist", input: { name: "Khruangbin" } },
    { name: "search_artist", input: { name: "Japanese Breakfast" } },
    {
      name: "find_tag",
      input: { query: "live music venue", entity_type: "place" },
    },
  ],
  [{ name: "find_venues", input: { tag_id: VENUE_TAG } }],
  [
    { name: "compare_headliners", input: {} },
    { name: "baseline_artists", input: { band: "mid" } },
    { name: "baseline_artists", input: { band: "opener" } },
  ],
];

export const finish = (venues: string[]): Turn => [
  {
    name: "finish",
    input: { anchor_venue_ids: venues, summary: "The rooms with fan data." },
  },
];

/** A toolbox on the synthetic Qloo, with every event it emits and every request it sends. */
export function toolboxFor(
  festival: Festival = LARKSPUR_FESTIVAL,
  cache: QlooCache = createMemoryCache(),
  route: (url: URL) => unknown = syntheticQloo,
) {
  const fake = fakeFetch(route);
  const events: BuildEvent[] = [];
  const toolbox = createToolbox({
    festival,
    qloo: createQlooClient({ apiKey: "test-key", cache, fetch: fake.fetch }),
    emit: (event) => events.push(event),
  });
  const calls = () =>
    events.flatMap((event) => (event.type === "call" ? [event.call] : []));
  return { toolbox, events, calls, requests: fake.requests };
}

/** Runs a toolbox through the opening turns, so venue reads can follow. */
export async function opened(
  festival: Festival = LARKSPUR_FESTIVAL,
  route: (url: URL) => unknown = syntheticQloo,
) {
  const kit = toolboxFor(festival, createMemoryCache(), route);
  for (const turn of OPENING)
    for (const call of turn as ToolCall[])
      await kit.toolbox.run(call.name, call.input);
  return kit;
}

/** A whole agent run on the synthetic Qloo, with its events. */
export async function runAgent(
  model: AgentModel,
  festival: Festival = LARKSPUR_FESTIVAL,
  route: (url: URL) => unknown = syntheticQloo,
) {
  const fake = fakeFetch(route);
  const events: BuildEvent[] = [];
  const result = await runUndercardAgent({
    festival,
    qloo: createQlooClient({
      apiKey: "test-key",
      cache: createMemoryCache(),
      fetch: fake.fetch,
    }),
    model,
    emit: (event) => events.push(event),
  });
  const calls: TraceCall[] = events.flatMap((event) =>
    event.type === "call" ? [event.call] : [],
  );
  const statuses = events.flatMap((event) =>
    event.type === "status" ? [event] : [],
  );
  return { result, events, calls, statuses, requests: fake.requests };
}

/** The JSON a tool gave the planner. */
export const resultOf = (outcome: { content: string }) =>
  JSON.parse(outcome.content) as Record<string, unknown>;
