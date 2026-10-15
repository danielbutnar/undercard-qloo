import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { BuildEvent } from "@/lib/build-events";
import { LineupSchema } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { MAX_AGENT_TURNS, runUndercardAgent } from "@/server/agent";
import { AGENT_TOOLS } from "@/server/agent-tools";
import type { AgentModel, AgentTurnRequest } from "@/server/ai";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { fakeFetch, syntheticId, syntheticQloo } from "./fake-qloo";

type ToolCall = { name: string; input: Record<string, unknown> };
type Turn = ToolCall[] | { text: string } | { refusal: true };

function message(turn: Turn, turnIndex: number): Anthropic.Message {
  const toolTurn = Array.isArray(turn);
  const content = toolTurn
    ? turn.map((call, k) => ({
        type: "tool_use",
        id: `toolu_${turnIndex}_${k}`,
        name: call.name,
        input: call.input,
      }))
    : "text" in turn
      ? [{ type: "text", text: turn.text, citations: null }]
      : [];
  return {
    id: `msg_synthetic_${turnIndex}`,
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content,
    stop_reason: toolTurn
      ? "tool_use"
      : "refusal" in turn
        ? "refusal"
        : "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  } as unknown as Anthropic.Message;
}

/** A model that plays back fixed turns and records every request it gets. */
function scriptedModel(turns: Turn[] | ((index: number) => Turn)) {
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

const VENUE_TAG = "urn:tag:genre:place:live_music_venue";
const LANTERN = syntheticId(201);
const FORT = syntheticId(202);

const PLAN: Turn[] = [
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
  [
    { name: "venue_artists", input: { band: "mid", venue_id: LANTERN } },
    { name: "venue_artists", input: { band: "opener", venue_id: LANTERN } },
    { name: "venue_artists", input: { band: "mid", venue_id: FORT } },
    { name: "venue_artists", input: { band: "opener", venue_id: FORT } },
  ],
  [
    {
      name: "finish",
      input: {
        anchor_venue_ids: [LANTERN, FORT],
        summary: "Two music rooms, both bands.",
      },
    },
  ],
];

async function build(model: AgentModel) {
  const fake = fakeFetch(syntheticQloo);
  const events: BuildEvent[] = [];
  await runUndercardAgent({
    festival: SAGEBRUSH_SOUND,
    qloo: createQlooClient({
      apiKey: "test-key",
      cache: createMemoryCache(),
      fetch: fake.fetch,
    }),
    model,
    emit: (event) => events.push(event),
  });
  const calls = events.flatMap((event) =>
    event.type === "call" ? [event.call] : [],
  );
  const lineup = events.find((event) => event.type === "lineup");
  const error = events.find((event) => event.type === "error");
  return {
    events,
    calls,
    lineup: lineup?.type === "lineup" ? lineup.lineup : null,
    error,
    requests: fake.requests,
  };
}

describe("runUndercardAgent", () => {
  it("follows the model's plan and returns 10 acts with every field Qloo backs", async () => {
    const { model } = scriptedModel(PLAN);
    const { calls, lineup, error, events } = await build(model);
    expect(error).toBeUndefined();
    expect(calls.map((call) => call.n)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    const acts = LineupSchema.parse(lineup).acts;
    expect(acts).toHaveLength(10);
    expect(acts.filter((act) => act.band === "mid")).toHaveLength(4);
    expect(acts.filter((act) => act.band === "opener")).toHaveLength(6);
    for (const act of acts) {
      expect([LANTERN, FORT]).toContain(act.anchorVenue.entityId);
      expect(act.reason).toContain(act.anchorVenue.name);
      expect(act.sharedTags).toHaveLength(2);
    }
    expect(events.at(-1)).toMatchObject({ type: "done", calls: 11 });
  });

  it("gives the model the festival brief and the Qloo tools, then every tool result in one message", async () => {
    const { model, requests } = scriptedModel(PLAN);
    await build(model);
    const first = requests[0];
    expect(first.tools.map((tool) => tool.name)).toEqual(
      AGENT_TOOLS.map((tool) => tool.name),
    );
    expect(JSON.stringify(first.messages[0].content)).toContain(
      "Japanese Breakfast",
    );
    const results = requests[1].messages.at(-1)!
      .content as Anthropic.ToolResultBlockParam[];
    expect(results.map((block) => block.tool_use_id)).toEqual([
      "toolu_0_0",
      "toolu_0_1",
      "toolu_0_2",
    ]);
    expect(
      results.every((block) => block.type === "tool_result" && !block.is_error),
    ).toBe(true);
  });

  it("stops at 12 Qloo calls even when the model keeps asking for more", async () => {
    // Unique names per turn, so no call is served from the cache.
    const searches = (turn: number): Turn =>
      Array.from({ length: 5 }, (_, i) => ({
        name: "search_artist",
        input: { name: `Synthetic ${turn}-${i}` },
      }));
    const { model, requests: turns } = scriptedModel(searches);
    const { calls, requests, error } = await build(model);
    expect(calls).toHaveLength(12);
    expect(requests).toHaveLength(12);
    expect(turns).toHaveLength(3);
    expect(error).toBeDefined();
  });

  it(`gives up after ${MAX_AGENT_TURNS} model turns without a finish`, async () => {
    const { model, requests } = scriptedModel(() => [
      { name: "compare_headliners", input: {} },
    ]);
    const { error } = await build(model);
    expect(requests).toHaveLength(MAX_AGENT_TURNS);
    expect(error).toBeDefined();
  });

  it("reports a refusal as an error and books nothing", async () => {
    const { model } = scriptedModel([{ refusal: true }]);
    const { lineup, error } = await build(model);
    expect(lineup).toBeNull();
    expect(error).toMatchObject({ type: "error" });
  });

  it("reports a model outage as an error event instead of throwing", async () => {
    const model: AgentModel = {
      nextTurn: async () => {
        throw new Error("synthetic outage");
      },
    };
    const { error, events } = await build(model);
    expect(error).toMatchObject({ type: "error" });
    expect(events.at(-1)?.type).toBe("done");
  });
});
