import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { BuildEventSchema, type BuildEvent } from "@/lib/build-events";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import type { AgentModel } from "@/server/ai";
import { handleUndercardBuild, ndjsonResponse } from "@/server/undercard-build";
import { createBuildStore } from "@/server/build-store";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { createMemoryLimiter } from "@/server/rate-limit";
import { fakeFetch, syntheticId, syntheticQloo } from "./fake-qloo";

async function readEvents(
  pending: Response | Promise<Response>,
): Promise<BuildEvent[]> {
  const response = await pending;
  const text = await response.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => BuildEventSchema.parse(JSON.parse(line)));
}

const turn = (calls: { name: string; input: object }[], index: number) =>
  ({
    id: `msg_${index}`,
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: calls.map((call, k) => ({
      type: "tool_use",
      id: `toolu_${index}_${k}`,
      ...call,
    })),
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  }) as unknown as Anthropic.Message;

const PLAN = [
  [
    { name: "search_artist", input: { name: "Khruangbin" } },
    { name: "search_artist", input: { name: "Japanese Breakfast" } },
    {
      name: "find_tag",
      input: { query: "live music venue", entity_type: "place" },
    },
  ],
  [
    {
      name: "find_venues",
      input: { tag_id: "urn:tag:genre:place:live_music_venue" },
    },
  ],
  [
    { name: "compare_headliners", input: {} },
    { name: "baseline_artists", input: { band: "mid" } },
    { name: "baseline_artists", input: { band: "opener" } },
  ],
  [
    {
      name: "venue_artists",
      input: { band: "mid", venue_id: syntheticId(201) },
    },
    {
      name: "venue_artists",
      input: { band: "opener", venue_id: syntheticId(201) },
    },
  ],
  [
    {
      name: "finish",
      input: { anchor_venue_ids: [syntheticId(201)], summary: "One room." },
    },
  ],
];

function scriptedModel(): AgentModel {
  let index = 0;
  return { nextTurn: async () => turn(PLAN[index] ?? [], index++) };
}

describe("ndjsonResponse", () => {
  it("streams one JSON event per line with a no-store, NDJSON response", async () => {
    const response = ndjsonResponse(async (emit) => {
      emit({ type: "status", text: "one" });
      emit({ type: "done", calls: 0, ms: 1 });
    });
    expect(response.headers.get("content-type")).toBe(
      "application/x-ndjson; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await readEvents(response)).map((event) => event.type)).toEqual([
      "status",
      "done",
    ]);
  });

  it("turns an unexpected failure into an error event and still closes the stream", async () => {
    const response = ndjsonResponse(async () => {
      throw new Error("synthetic failure");
    });
    const events = await readEvents(response);
    expect(events.map((event) => event.type)).toEqual(["error", "done"]);
  });
});

describe("handleUndercardBuild (POST /api/undercard)", () => {
  it("streams a trace event per Qloo call, then the lineup and done", async () => {
    const fake = fakeFetch(syntheticQloo);
    const response = handleUndercardBuild({
      festival: SAGEBRUSH_SOUND,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      store: createBuildStore(createMemoryCache()),
      fresh: true,
      qloo: () =>
        createQlooClient({
          apiKey: "test-key",
          cache: createMemoryCache(),
          fetch: fake.fetch,
        }),
      model: scriptedModel,
    });
    const events = await readEvents(response);
    const types = events.map((event) => event.type);
    // Its plan's 9 calls, then Qloo's location signal for each tier's acts (WS13.4).
    expect(types.filter((type) => type === "call")).toHaveLength(13);
    expect(types.indexOf("lineup")).toBeGreaterThan(types.lastIndexOf("call"));
    expect(types.at(-1)).toBe("done");
    const lineup = events.find((event) => event.type === "lineup");
    expect(lineup?.type === "lineup" && lineup.lineup.acts).toHaveLength(10);
  });

  it("explains a missing Qloo key instead of failing", async () => {
    const response = handleUndercardBuild({
      festival: SAGEBRUSH_SOUND,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      store: createBuildStore(createMemoryCache()),
      fresh: true,
      qloo: () => null,
      model: scriptedModel,
    });
    const events = await readEvents(response);
    expect(events[0]).toEqual({
      type: "error",
      message: "Qloo isn't configured on this server.",
    });
    expect(events.at(-1)?.type).toBe("done");
  });

  it("explains a missing model key instead of failing", async () => {
    const response = handleUndercardBuild({
      festival: SAGEBRUSH_SOUND,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      store: createBuildStore(createMemoryCache()),
      fresh: true,
      qloo: () =>
        createQlooClient({
          apiKey: "k",
          cache: createMemoryCache(),
          fetch: fakeFetch(syntheticQloo).fetch,
        }),
      model: () => null,
    });
    const events = await readEvents(response);
    expect(events[0]).toEqual({
      type: "error",
      message: "The planning model isn't configured on this server.",
    });
  });
});
