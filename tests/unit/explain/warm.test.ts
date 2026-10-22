// WS7 part (a), step 4: what scripts/attribution-warm.ts does, on invented builds and an in-memory
// cache. It calls nothing unless LIVE=1 with MAX_CALLS, stops before an attempt past it, refuses
// builds that aren't the pinned ones, and caches the very keys the app's read uses. Boise's two
// entries can be written from section 35's saved answers, dry by default.
import { describe, expect, it, vi } from "vitest";
import { attributionFor, explainCalls } from "@/server/attribution";
import {
  PinMismatch,
  pinnedBuilds,
  readOnlyCache,
  seedFromSaved,
  warmLive,
  warmPlan,
  warmSettings,
} from "@/server/attribution-warm";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { fakeFetch } from "../m2/fake-qloo";
import { inventedBuild, inventedExplainQloo } from "./invented";

const instant = async () => {};
const noJitter = { sleep: instant, random: () => 0 };

/** Two festivals' builds; B's crowd is older, so its calls (and cache keys) are its own. */
function twoBuilds(): SavedBuild[] {
  const b = inventedBuild({ id: "build-b", festivalId: "festival-b" });
  return [
    inventedBuild({ id: "build-a", festivalId: "festival-a" }),
    { ...b, context: { ...b.context, ages: ["35_to_44"] } },
  ];
}

/** A cache that counts its writes. */
function counted(cache: QlooCache = createMemoryCache()) {
  const keys: string[] = [];
  const wrapped: QlooCache = {
    kind: cache.kind,
    get: (key) => cache.get(key),
    set: async (key, value, ttl) => {
      keys.push(key);
      await cache.set(key, value, ttl);
    },
  };
  return { cache: wrapped, keys };
}

describe("the warm script's settings (WS7 step 4)", () => {
  it("is a dry run unless LIVE=1, and LIVE=1 needs MAX_CALLS", () => {
    expect(warmSettings({})).toEqual({
      live: false,
      maxCalls: null,
      seedBoise: false,
    });
    expect(() => warmSettings({ LIVE: "1" })).toThrow(/MAX_CALLS/);
    expect(warmSettings({ LIVE: "1", MAX_CALLS: "56" })).toEqual({
      live: true,
      maxCalls: 56,
      seedBoise: false,
    });
    for (const bad of ["0", "-3", "5.5", "56 calls", ""])
      expect(() => warmSettings({ LIVE: "1", MAX_CALLS: bad })).toThrow(
        /MAX_CALLS/,
      );
  });

  it("seeds Boise only with its own flag, and never in the same run as live calls", () => {
    expect(warmSettings({ SEED_BOISE: "1" }).seedBoise).toBe(true);
    expect(() =>
      warmSettings({ LIVE: "1", MAX_CALLS: "56", SEED_BOISE: "1" }),
    ).toThrow(/separate/);
  });
});

describe("the pinned builds, read only (WS7 step 4)", () => {
  async function storeWith(builds: SavedBuild[]) {
    const memory = createMemoryCache();
    const store = createBuildStore(memory);
    for (const build of builds) await store.save(build);
    return createBuildStore(readOnlyCache(memory));
  }
  const pins = (entries: [string, string][]) => ({
    festivals: entries.map(([festivalId, buildId]) => ({
      festivalId,
      buildId,
    })),
  });

  it("gives each festival's latest build when every one is the pinned build", async () => {
    const store = await storeWith(twoBuilds());
    const builds = await pinnedBuilds({
      store,
      festivalIds: ["festival-a", "festival-b"],
      pinned: pins([
        ["festival-a", "build-a"],
        ["festival-b", "build-b"],
      ]),
    });
    expect(builds.map((build) => build.id)).toEqual(["build-a", "build-b"]);
  });

  it("stops, naming the festivals, when a latest build isn't the pinned one or is missing", async () => {
    const store = await storeWith(twoBuilds());
    const read = pinnedBuilds({
      store,
      festivalIds: ["festival-a", "festival-b", "festival-c"],
      pinned: pins([
        ["festival-a", "build-a"],
        ["festival-b", "build-b-older"],
        ["festival-c", "build-c"],
      ]),
    });
    await expect(read).rejects.toBeInstanceOf(PinMismatch);
    await expect(read).rejects.toThrow(/festival-b, festival-c/);
  });

  it("can't write through the read-only cache", async () => {
    const readOnly = readOnlyCache(createMemoryCache());
    await expect(readOnly.set("any", 1, 60)).rejects.toThrow(/read only/);
  });
});

describe("the warm run (WS7 step 4)", () => {
  it("plans two calls per build and marks the ones the cache already holds", async () => {
    const { cache } = counted();
    const [a, b] = twoBuilds();
    const before = await warmPlan([a, b], readOnlyCache(cache));
    expect(
      before.map((row) => [row.festivalId, row.call.band, row.cached]),
    ).toEqual([
      ["festival-a", "mid", false],
      ["festival-a", "opener", false],
      ["festival-b", "mid", false],
      ["festival-b", "opener", false],
    ]);

    await warmLive({
      rows: before.slice(0, 2),
      cache,
      apiKey: "test-key",
      fetch: fakeFetch(inventedExplainQloo).fetch,
      maxCalls: 2,
      client: noJitter,
    });
    const after = await warmPlan([a, b], readOnlyCache(cache));
    expect(after.map((row) => row.cached)).toEqual([true, true, false, false]);
  });

  it("makes each missing call once, one at a time, and the app then reads every split from the cache", async () => {
    const { cache, keys } = counted();
    const builds = twoBuilds();
    let inFlight = 0;
    let most = 0;
    const fake = fakeFetch(inventedExplainQloo);
    const fetch = (async (...args: Parameters<typeof globalThis.fetch>) => {
      most = Math.max(most, ++inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      try {
        return await fake.fetch(...args);
      } finally {
        inFlight--;
      }
    }) as typeof globalThis.fetch;
    const sleep = vi.fn(instant);

    const report = await warmLive({
      rows: await warmPlan(builds, readOnlyCache(cache)),
      cache,
      apiKey: "test-key",
      fetch,
      maxCalls: 4,
      pauseMs: 1200,
      sleep,
      client: noJitter,
    });

    expect(report).toMatchObject({ attempts: 4, fetched: 4, stopped: null });
    expect(
      report.rows.map((row) => [row.band, row.acts, row.withSplit]),
    ).toEqual([
      ["mid", 4, 4],
      ["opener", 6, 6],
      ["mid", 4, 4],
      ["opener", 6, 6],
    ]);
    // The mid-size range sent five inputs and Qloo scored four (the Diner none).
    expect(report.rows[0]).toMatchObject({ inputs: 5, inputsScored: 4 });
    expect(most).toBe(1);
    expect(keys).toHaveLength(4);
    expect(sleep).toHaveBeenCalledWith(1200);

    for (const build of builds)
      expect(Object.keys(await attributionFor(build, cache))).toHaveLength(10);

    // A second run finds everything cached and calls nothing.
    const again = await warmLive({
      rows: await warmPlan(builds, readOnlyCache(cache)),
      cache,
      apiKey: "test-key",
      fetch,
      maxCalls: 1,
      client: noJitter,
    });
    expect(again).toMatchObject({ attempts: 0, fetched: 0, alreadyCached: 4 });
  });

  it("refuses to start when the plan needs more calls than MAX_CALLS", async () => {
    const fake = fakeFetch(inventedExplainQloo);
    await expect(
      warmLive({
        rows: await warmPlan(twoBuilds(), createMemoryCache()),
        cache: createMemoryCache(),
        apiKey: "test-key",
        fetch: fake.fetch,
        maxCalls: 3,
        client: noJitter,
      }),
    ).rejects.toThrow(/needs 4 calls.*MAX_CALLS is 3/);
    expect(fake.requests).toHaveLength(0);
  });

  it("stops before an attempt past MAX_CALLS, a retry included", async () => {
    let first = true;
    const fake = fakeFetch((url) => {
      if (first) {
        first = false;
        return new Response("{}", { status: 429 });
      }
      return inventedExplainQloo(url);
    });
    const { cache, keys } = counted();
    const report = await warmLive({
      rows: await warmPlan(twoBuilds(), createMemoryCache()),
      cache,
      apiKey: "test-key",
      fetch: fake.fetch,
      maxCalls: 4,
      client: noJitter,
    });
    // Call 1 took two attempts, calls 2 and 3 one each; call 4 would be a fifth attempt.
    expect(fake.requests).toHaveLength(4);
    expect(report).toMatchObject({ attempts: 4, fetched: 3, stopped: "cap" });
    expect(keys).toHaveLength(3);
  });

  it("stops at a malformed answer or an error answer, and caches nothing for it", async () => {
    for (const answer of [
      { success: true },
      new Response("{}", { status: 403 }),
    ]) {
      const fake = fakeFetch(() => answer);
      const { cache, keys } = counted();
      const report = await warmLive({
        rows: await warmPlan(twoBuilds(), createMemoryCache()),
        cache,
        apiKey: "test-key",
        fetch: fake.fetch,
        maxCalls: 4,
        client: noJitter,
      });
      expect(fake.requests).toHaveLength(1);
      expect(report.attempts).toBe(1);
      expect(report.fetched).toBe(0);
      expect(report.stopped).toMatch(
        answer instanceof Response ? /HTTP 403/ : /malformed/,
      );
      expect(keys).toHaveLength(0);
    }
  });
});

describe("Boise's two entries from section 35's saved answers (WS7 step 4)", () => {
  /** A saved answer as section 35 wrote it: { status, params, body }, take as a number. */
  function savedAnswers(build: SavedBuild) {
    return Object.fromEntries(
      explainCalls(build).map((call) => [
        call.band,
        {
          status: 200,
          params: {
            "filter.type": "urn:entity:artist",
            "signal.interests.entities": call.signalEntityIds.join(","),
            "filter.results.entities": call.actIds.join(","),
            "signal.demographics.age": call.ages.join(","),
            "feature.explainability": "true",
            take: call.actIds.length,
          },
          body: inventedExplainQloo(
            new URL(
              `https://hackathon.api.qloo.com/v2/insights?${new URLSearchParams(
                {
                  "signal.interests.entities": call.signalEntityIds.join(","),
                  "filter.results.entities": call.actIds.join(","),
                },
              )}`,
            ),
          ),
        },
      ]),
    );
  }

  it("writes nothing on a dry run, and says what it would write", async () => {
    const build = inventedBuild();
    const { cache, keys } = counted();
    const report = await seedFromSaved({
      build,
      answers: savedAnswers(build),
      cache,
      write: false,
    });
    expect(keys).toHaveLength(0);
    expect(
      report.map((row) => [row.band, row.matched, row.acts, row.written]),
    ).toEqual([
      ["mid", true, 4, false],
      ["opener", true, 6, false],
    ]);
    expect(report[0].key).toMatch(
      /^qloo:v2:\/v2\/insights\?feature\.explainability=true&filter\.results\.entities=<4 ids>&filter\.type=urn:entity:artist&signal\.demographics\.age=25_to_29,30_to_34&signal\.interests\.entities=<5 ids>&take=4$/,
    );
    expect(report[0].ttlSeconds).toBeGreaterThan(0);
    expect(await attributionFor(build, cache)).toEqual({});
  });

  it("writes exactly the two keys the app's client computes, so the app reads Boise's split", async () => {
    const build = inventedBuild();
    const { cache, keys } = counted();
    const report = await seedFromSaved({
      build,
      answers: savedAnswers(build),
      cache,
      write: true,
    });
    expect(report.map((row) => row.written)).toEqual([true, true]);
    expect(keys).toHaveLength(2);
    expect(Object.keys(await attributionFor(build, cache))).toHaveLength(10);
    // And the warm run then has nothing to call for this build.
    const plan = await warmPlan([build], readOnlyCache(cache));
    expect(plan.every((row) => row.cached)).toBe(true);

    // Once written, a second seed leaves them as they are.
    const second = await seedFromSaved({
      build,
      answers: savedAnswers(build),
      cache,
      write: true,
    });
    expect(second.map((row) => [row.alreadyCached, row.written])).toEqual([
      [true, false],
      [true, false],
    ]);
    expect(keys).toHaveLength(2);
  });

  it("writes nothing for a range whose saved call differs from the build's, or whose answer isn't usable", async () => {
    const build = inventedBuild();
    const answers = savedAnswers(build);
    const cases = [
      {
        ...answers.mid,
        params: {
          ...answers.mid.params,
          "signal.demographics.age": "25_to_29",
        },
      },
      { ...answers.mid, params: { ...answers.mid.params, take: 3 } },
      {
        ...answers.mid,
        params: { ...answers.mid.params, "filter.popularity.min": 0.8 },
      },
      {
        ...answers.mid,
        params: Object.fromEntries(
          Object.entries(answers.mid.params).filter(
            ([key]) => key !== "feature.explainability",
          ),
        ),
      },
      { ...answers.mid, status: 429 },
      { ...answers.mid, body: { success: true } },
      undefined,
    ];
    for (const mid of cases) {
      const { cache, keys } = counted();
      const report = await seedFromSaved({
        build,
        answers: { mid, opener: answers.opener },
        cache,
        write: true,
      });
      expect(report[0]).toMatchObject({ band: "mid", written: false });
      expect(report[0].reason).toBeTruthy();
      expect(report[1]).toMatchObject({ band: "opener", written: true });
      expect(keys).toHaveLength(1);
      // The one key written is the opening range's: six acts.
      expect(keys[0]).toMatch(/take=6$/);
    }
  });
});
