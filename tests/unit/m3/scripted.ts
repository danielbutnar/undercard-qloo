// Shared test doubles for M3: a scripted planner that follows the M2 plan, and a build
// handler wired to the synthetic Qloo. Everything here is invented data.
import type Anthropic from "@anthropic-ai/sdk";
import { BuildEventSchema, type BuildEvent } from "@/lib/build-events";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import type { AgentModel } from "@/server/ai";
import { createBuildStore } from "@/server/build-store";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { handleUndercardBuild } from "@/server/undercard-build";
import { fakeFetch, syntheticId, syntheticQloo } from "../m2/fake-qloo";

export const LANTERN = syntheticId(201);
export const FORT = syntheticId(202);

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
    { name: "venue_artists", input: { band: "mid", venue_id: LANTERN } },
    { name: "venue_artists", input: { band: "opener", venue_id: LANTERN } },
    { name: "venue_artists", input: { band: "mid", venue_id: FORT } },
    { name: "venue_artists", input: { band: "opener", venue_id: FORT } },
  ],
  [
    {
      name: "finish",
      input: { anchor_venue_ids: [LANTERN, FORT], summary: "Two rooms." },
    },
  ],
];

/** A planner that plays the M2 plan and counts its turns. */
export function scriptedPlanner() {
  let turns = 0;
  const model: AgentModel = {
    async nextTurn() {
      const index = turns++;
      const calls = PLAN[index] ?? [];
      return {
        id: `msg_${index}`,
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5-5",
        content: calls.map((call, k) => ({
          type: "tool_use",
          id: `toolu_${index}_${k}`,
          ...call,
        })),
        stop_reason: calls.length ? "tool_use" : "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      } as unknown as Anthropic.Message;
    },
  };
  return { model, turns: () => turns };
}

export async function readEvents(response: Response): Promise<BuildEvent[]> {
  return (await response.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => BuildEventSchema.parse(JSON.parse(line)));
}

/** One server: a shared cache, synthetic Qloo and a scripted planner. */
export function syntheticServer() {
  const cache = createMemoryCache();
  const fake = fakeFetch(syntheticQloo);
  const planner = scriptedPlanner();
  const store = createBuildStore(cache);
  const qloo = createQlooClient({
    apiKey: "test-key",
    cache,
    fetch: fake.fetch,
  });
  const build = (options: { fresh?: boolean } = {}) =>
    handleUndercardBuild({
      festival: SAGEBRUSH_SOUND,
      qloo: () => qloo,
      model: () => planner.model,
      store,
      fresh: options.fresh ?? false,
      replayDelayMs: 10,
    });
  return { cache, store, qloo, requests: fake.requests, planner, build };
}
