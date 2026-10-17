import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import {
  SYNTHETIC_BUILD_ID,
  syntheticLlmOnly,
  syntheticSavedBuild,
} from "../../e2e/synthetic-build";
import { LineupSchema } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore, SavedBuildSchema } from "@/server/build-store";
import {
  serverBuildStore,
  serverLimiter,
  serverModel,
  serverQloo,
} from "@/server/deps";
import { handleLlmOnly } from "@/server/llm-only";
import { createQlooCache, SYNTHETIC_ENV } from "@/server/qloo-cache";

// Every key a local .env.local might hold, so synthetic mode is shown to ignore them.
const KEYS = {
  QLOO_API_KEY: "qloo-test-key",
  ANTHROPIC_API_KEY: "anthropic-test-key",
  UPSTASH_REDIS_REST_URL: "https://upstash.invalid",
  UPSTASH_REDIS_REST_TOKEN: "upstash-test-token",
};
const SYNTHETIC = { ...KEYS, [SYNTHETIC_ENV]: "1" };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the synthetic saved build", () => {
  it("is a saved build the store accepts: the fixture's lineup, 12 calls and the rooms it tested", () => {
    const saved = SavedBuildSchema.parse(syntheticSavedBuild());
    expect(saved.id).toBe(SYNTHETIC_BUILD_ID);
    expect(saved.festivalId).toBe(SAGEBRUSH_SOUND.id);
    expect(saved.lineup).toEqual(LineupSchema.parse(fixture));
    expect(saved.trace.map((call) => call.n)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(saved.context.baselines.mid).toHaveLength(50);
    expect(saved.context.baselines.opener).toHaveLength(50);
    const rooms = (band: "mid" | "opener") =>
      saved.context.anchors[band]?.map((venue) => venue.name);
    expect(rooms("mid")).toEqual([
      "The Lantern Room",
      "Fort Street Ballroom",
      "Cottonwood Social Hall",
    ]);
    expect(rooms("opener")).toEqual([
      "The Lantern Room",
      "Fort Street Ballroom",
    ]);
  });

  it("tests every room an act names", () => {
    const saved = syntheticSavedBuild();
    const tested = new Set(
      Object.values(saved.context.anchors).flatMap((venues) =>
        (venues ?? []).map((venue) => venue.entityId),
      ),
    );
    for (const act of saved.lineup.acts)
      expect(tested.has(act.anchorVenue.entityId)).toBe(true);
  });
});

describe("synthetic mode, for local e2e runs and design shots", () => {
  it("serves the synthetic build as the latest, from memory, even with Upstash set", async () => {
    const cache = createQlooCache(SYNTHETIC);
    expect(cache.kind).toBe("memory");
    const latest = await createBuildStore(cache).latest(SAGEBRUSH_SOUND.id);
    expect(latest?.id).toBe(SYNTHETIC_BUILD_ID);
  });

  it("answers LLM only from the synthetic answer, never the model", async () => {
    const model = vi.fn(() => null);
    const response = await handleLlmOnly({
      festival: SAGEBRUSH_SOUND,
      cache: createQlooCache(SYNTHETIC),
      limiter: serverLimiter(SYNTHETIC),
      ip: "203.0.113.7",
      model,
    });
    const body = await response.json();
    expect(body.cached).toBe(true);
    expect(body.lineup.picks).toEqual(syntheticLlmOnly().lineup.picks);
    expect(model).not.toHaveBeenCalled();
  });

  it("has no Qloo client and no model, so nothing spends a Qloo or Claude call", async () => {
    for (const [key, value] of Object.entries(SYNTHETIC))
      vi.stubEnv(key, value);
    expect(serverQloo()).toBeNull();
    expect(serverModel()).toBeNull();
    const latest = await serverBuildStore().latest(SAGEBRUSH_SOUND.id);
    expect(latest?.id).toBe(SYNTHETIC_BUILD_ID);
  });

  it("stays off without the variable", () => {
    for (const [key, value] of Object.entries(KEYS)) vi.stubEnv(key, value);
    expect(createQlooCache(KEYS).kind).toBe("upstash");
    expect(serverQloo()).not.toBeNull();
  });
});
