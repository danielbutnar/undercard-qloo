// A 2.0 build's split (Qloo's explain calls, section 35) lives under the cache prefix the build
// records, as its replay, refill, redraft and venue switch already read (src/server/saved-reads.ts):
// the warm for the 29 re-run builds writes nothing under the 1.0 builds' qloo:v2:, and a 2.0 build
// never reads a split from there. Invented build, names and shares (./invented.ts).
import { describe, expect, it } from "vitest";
import { attributionFor } from "@/server/attribution";
import { readOnlyCache, warmLive, warmPlan } from "@/server/attribution-warm";
import { QLOO_CACHE_PREFIX } from "@/server/qloo";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { fakeFetch } from "../m2/fake-qloo";
import { inventedBuild, inventedExplainQloo } from "./invented";

const PREFIX = "qloo:rerun-test:";
const instant = async () => {};
const noJitter = { sleep: instant, random: () => 0 };

function recording() {
  const memory = createMemoryCache();
  const keys: string[] = [];
  const cache: QlooCache = {
    kind: "memory",
    get: (key) => memory.get(key),
    set: async (key, value, ttl) => {
      keys.push(key);
      await memory.set(key, value, ttl);
    },
  };
  return { cache, keys };
}

const warm = async (builds: Parameters<typeof warmPlan>[0], cache: QlooCache) =>
  warmLive({
    rows: await warmPlan(builds, readOnlyCache(cache)),
    cache,
    apiKey: "test-key",
    fetch: fakeFetch(inventedExplainQloo).fetch,
    maxCalls: 2,
    sleep: instant,
    client: noJitter,
  });

describe("a 2.0 build's split, under its own cache prefix", () => {
  it("is warmed into the build's prefix and read from it, with nothing written under qloo:v2:", async () => {
    const { cache, keys } = recording();
    const two = inventedBuild({
      id: "build-two",
      cachePrefix: PREFIX,
      engine: 2,
    });
    const report = await warm([two], cache);
    expect(report).toMatchObject({ fetched: 2, stored: 2, stopped: null });
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key.startsWith(PREFIX))).toBe(true);
    expect(keys.some((key) => key.startsWith(QLOO_CACHE_PREFIX))).toBe(false);
    expect(Object.keys(await attributionFor(two, cache))).toHaveLength(10);
    // A second plan finds both calls cached under the build's prefix.
    const again = await warmPlan([two], readOnlyCache(cache));
    expect(again.every((row) => row.cached)).toBe(true);
  });

  it("never reads a 2.0 build's split from the 1.0 builds' prefix", async () => {
    const { cache } = recording();
    const one = inventedBuild();
    await warm([one], cache);
    expect(Object.keys(await attributionFor(one, cache))).toHaveLength(10);
    const two = {
      ...one,
      id: "build-two",
      cachePrefix: PREFIX,
      engine: 2 as const,
    };
    expect(Object.keys(await attributionFor(two, cache))).toHaveLength(0);
    expect(
      (await warmPlan([two], readOnlyCache(cache))).every((row) => !row.cached),
    ).toBe(true);
  });
});

describe("the builds to warm, by id (BUILDS=<file>)", () => {
  it("reads each named build from the store, in order, and stops naming a missing one", async () => {
    const { createBuildStore } = await import("@/server/build-store");
    const { buildsById } = await import("@/server/attribution-warm");
    const store = createBuildStore(createMemoryCache());
    const a = inventedBuild({
      id: "build-a",
      festivalId: "festival-a",
      cachePrefix: PREFIX,
      engine: 2,
    });
    const b = inventedBuild({
      id: "build-b",
      festivalId: "festival-b",
      cachePrefix: PREFIX,
      engine: 2,
    });
    await store.keep(a);
    await store.keep(b);
    const builds = await buildsById(store, ["build-b", "build-a"]);
    expect(builds.map((build) => build.id)).toEqual(["build-b", "build-a"]);
    await expect(buildsById(store, ["build-a", "nowhere"])).rejects.toThrow(
      /nowhere/,
    );
  });
});
