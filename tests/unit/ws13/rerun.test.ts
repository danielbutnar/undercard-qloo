// WS13 item 11: the re-runs (scripts/rerun-towns.ts). Each town's 2.0 build is made under a new
// cache prefix and saved by its own id, recording the prefix its replay and venue switch read;
// no latest pointer moves, and Boise's 1.0 What-if lineups hash the same before and after the
// 2.0 build's writes (a fake cache holding both builds' entries). The script also sets each demo
// town's 2.0 bill beside the saved 1.0 bill, tier by tier. Invented data only.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assembleLineup, type AssemblyInput } from "@/lib/assemble-lineup";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { TOWNS } from "@/lib/towns";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { createQlooClient, QLOO_CACHE_PREFIX } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import {
  billBeside,
  countingFetch,
  OverBudget,
  pickTowns,
  RateLimited,
  rerunTowns,
} from "@/server/rerun";
import { replayClimbs } from "@/server/undercard-build";
import { readVenueSwitch } from "@/server/venue-switch";
import { fakeFetch, syntheticId, syntheticQloo } from "../m2/fake-qloo";
import { scriptedPlanner } from "../m3/scripted";
const ONE_POINT_OH = "boise-one-point-oh";

const PREFIX = "qloo:rerun-test:";

const VENUES = [
  { entityId: syntheticId(201), name: "The Lantern Room" },
  { entityId: syntheticId(202), name: "Fort Street Ballroom" },
];
const PAIR = [syntheticId(1), syntheticId(2)];
const AGES = ["25_to_29", "30_to_34"];

/**
 * Boise's saved 1.0 build as production has it: its rankings cached as plain reads under the
 * 1.0 builds' prefix, its lineup the rule's with no control, saved as Sagebrush Sound's latest.
 */
async function production() {
  const cache = createMemoryCache();
  const store = createBuildStore(cache);
  const qloo = createQlooClient({
    apiKey: "k",
    cache,
    fetch: fakeFetch(syntheticQloo).fetch,
  });
  const ask = (
    band: (typeof SAGEBRUSH_SOUND.feeBands)[number],
    venue?: string,
  ) =>
    qloo.artists({
      signalEntityIds: venue ? [...PAIR, venue] : PAIR,
      popularityMin: band.minPopularity,
      popularityMax: band.maxPopularity,
      excludeEntityIds: PAIR,
      ages: AGES,
    });
  const headliners = (
    await Promise.all(
      ["Khruangbin", "Japanese Breakfast"].map(
        async (name) => (await qloo.search({ query: name })).data[0],
      ),
    )
  ).map(({ entityId, name, tags }) => ({ entityId, name, tags }));
  const input: AssemblyInput = {
    bands: SAGEBRUSH_SOUND.feeBands,
    headliners,
    comparedTags: [{ name: "Dream Pop", score: 0.9 }],
    baselines: {},
    venueRuns: [],
  };
  const trace: SavedBuild["trace"] = [];
  for (const band of SAGEBRUSH_SOUND.feeBands) {
    input.baselines[band.id] = (await ask(band)).data;
    for (const venue of VENUES) {
      input.venueRuns.push({
        venue,
        band: band.id,
        artists: (await ask(band, venue.entityId)).data,
      });
      trace.push({
        n: trace.length + 1,
        tool: "venue_artists",
        endpoint: "/v2/insights",
        summary: `${band.label}-band artists for the headliners and ${venue.name}`,
        params: [],
        resultCount: 50,
        ms: 0,
        cached: false,
      });
    }
  }
  await store.save({
    id: ONE_POINT_OH,
    festivalId: SAGEBRUSH_SOUND.id,
    createdAt: "2026-10-17T12:13:00.000Z",
    trace,
    lineup: {
      festivalId: SAGEBRUSH_SOUND.id,
      acts: assembleLineup(input).acts,
    },
    context: {
      headliners,
      comparedTags: input.comparedTags,
      baselines: Object.fromEntries(
        SAGEBRUSH_SOUND.feeBands.map((band) => [
          band.id,
          input.baselines[band.id]!.map((artist) => artist.entityId),
        ]),
      ),
      anchors: { mid: VENUES, opener: VENUES },
      ages: AGES,
    },
  });
  return { cache, store };
}

const cacheOnly = (cache: ReturnType<typeof createMemoryCache>) =>
  createQlooClient({
    apiKey: "k",
    cache,
    cacheOnly: true,
    fetch: () => {
      throw new Error("a read of a saved build must not call Qloo");
    },
  });

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function pointers(store: ReturnType<typeof createBuildStore>) {
  return Promise.all(
    TOWNS.map(async (town) => (await store.latest(town.festival.id))?.id),
  );
}

async function rerun(
  cache: ReturnType<typeof createMemoryCache>,
  store: ReturnType<typeof createBuildStore>,
  maxCalls = 200,
  route: (url: URL) => unknown = syntheticQloo,
) {
  const counted = countingFetch({
    fetch: fakeFetch(route).fetch,
    maxCalls,
  });
  const runs = await rerunTowns({
    // Boise, which has a saved build, and Austin, which here has none: neither pointer moves.
    festivals: [SAGEBRUSH_SOUND, TOWNS[1].festival],
    qloo: () =>
      createQlooClient({
        apiKey: "k",
        cache,
        fetch: counted.fetch,
        prefix: PREFIX,
      }),
    model: () => scriptedPlanner().model,
    store,
    budget: counted,
  });
  return { runs, counted };
}

describe("a re-run (WS13.11)", () => {
  it("saves each town's 2.0 build by its own id, recording its prefix, and moves no latest pointer", async () => {
    const { cache, store } = await production();
    const before = await pointers(store);
    expect(before[0]).toBe(ONE_POINT_OH);
    expect(before[1]).toBeUndefined();
    const { runs } = await rerun(cache, store);
    expect(runs.map((run) => run.festivalId)).toEqual([
      SAGEBRUSH_SOUND.id,
      TOWNS[1].festival.id,
    ]);
    expect(await pointers(store)).toEqual(before);
    const [boise] = runs;
    expect(boise.festivalId).toBe(SAGEBRUSH_SOUND.id);
    expect(boise.buildId).not.toBeNull();
    const kept = await store.byId(boise.buildId!);
    expect(kept).toMatchObject({ engine: 2, cachePrefix: PREFIX });
  });

  it("leaves Boise's 1.0 What-if lineups hashing the same, while the 2.0 build replays and switches from its own prefix", async () => {
    const { cache, store } = await production();
    const whatIf = () =>
      readVenueSwitch({
        store,
        festival: SAGEBRUSH_SOUND,
        qloo: cacheOnly(cache),
        buildId: ONE_POINT_OH,
      });
    const saved = await whatIf();
    expect(saved).not.toBeNull();
    const before = hash(saved);
    const { runs } = await rerun(cache, store);
    expect(hash(await whatIf())).toBe(before);

    const two = (await store.byId(runs[0].buildId!))!;
    expect(two.cachePrefix).toBe(PREFIX);
    expect(PREFIX).not.toBe(QLOO_CACHE_PREFIX);
    const switched = await readVenueSwitch({
      store,
      festival: SAGEBRUSH_SOUND,
      qloo: cacheOnly(cache),
      buildId: two.id,
    });
    expect(switched?.buildId).toBe(two.id);
    const climbs = await replayClimbs(two, SAGEBRUSH_SOUND, cacheOnly(cache));
    expect(climbs.size).toBeGreaterThan(0);
  });

  it("sets the 2.0 bill beside the saved 1.0 bill, tier by tier: acts and open slots", async () => {
    const { cache, store } = await production();
    const { runs } = await rerun(cache, store);
    const one = (await store.byId(ONE_POINT_OH))!;
    const two = (await store.byId(runs[0].buildId!))!;
    expect(billBeside(one, two, SAGEBRUSH_SOUND.feeBands)).toEqual({
      mid: { saved: { acts: 4, open: 0 }, rerun: { acts: 4, open: 0 } },
      opener: { saved: { acts: 6, open: 0 }, rerun: { acts: 6, open: 0 } },
    });
    expect(billBeside(one, null, SAGEBRUSH_SOUND.feeBands).mid.rerun).toEqual({
      acts: 0,
      open: 4,
    });
  });

  it("stops at the first rate-limit answer, with no more requests", async () => {
    const { cache, store } = await production();
    let asked = 0;
    const { runs, counted } = await rerun(cache, store, 200, (url) => {
      asked++;
      return asked === 3
        ? new Response("{}", { status: 429 })
        : syntheticQloo(url);
    });
    expect(runs[0].stoppedBy).toBeInstanceOf(RateLimited);
    expect(counted.used()).toBe(3);
    expect(runs[0].buildId).toBeNull();
  });

  it("never sends more than MAX_CALLS requests, and starts no town it can't finish within the cap", async () => {
    const { cache, store } = await production();
    const short = await rerun(cache, store, 10);
    expect(short.runs[0].stoppedBy).toBeInstanceOf(OverBudget);
    expect(short.counted.used()).toBe(0);
  });

  // Daniel, 2026-10-28 14:10: a town whose trace holds ANY failed or busy call is redone, even
  // when its run finished; and each run is timed against the route's 120-second limit.
  it("counts every answer that isn't OK, and every request that throws, as failed", async () => {
    let asked = 0;
    const counted = countingFetch({
      fetch: async () => {
        asked++;
        if (asked === 1) return new Response("{}", { status: 503 });
        if (asked === 2) throw new TypeError("fetch failed");
        return new Response("{}", { status: 200 });
      },
      maxCalls: 10,
    });
    expect((await counted.fetch("https://q.test/a")).status).toBe(503);
    await expect(counted.fetch("https://q.test/b")).rejects.toThrow(
      "fetch failed",
    );
    expect((await counted.fetch("https://q.test/c")).status).toBe(200);
    expect(counted.used()).toBe(3);
    expect(counted.failed()).toBe(2);
  });

  it("reports each town's failed or busy answers, even when its run finishes", async () => {
    const { cache, store } = await production();
    let asked = 0;
    const counted = countingFetch({
      fetch: fakeFetch((url) => {
        asked++;
        return asked === 3
          ? new Response("{}", { status: 503 })
          : syntheticQloo(url);
      }).fetch,
      maxCalls: 200,
    });
    const runs = await rerunTowns({
      festivals: [SAGEBRUSH_SOUND],
      qloo: () =>
        createQlooClient({
          apiKey: "k",
          cache,
          fetch: counted.fetch,
          prefix: PREFIX,
          sleep: async () => {},
        }),
      model: () => scriptedPlanner().model,
      store,
      budget: counted,
    });
    expect(runs[0].stoppedBy).toBeNull();
    expect(runs[0].buildId).not.toBeNull();
    expect(runs[0].failedCalls).toBe(1);
  });

  it("times each town's run, start to finish", async () => {
    const { cache, store } = await production();
    let now = 0;
    const route = fakeFetch(syntheticQloo).fetch;
    const counted = countingFetch({
      fetch: async (input, init) => {
        now += 10;
        return route(input, init);
      },
      maxCalls: 200,
    });
    const runs = await rerunTowns({
      festivals: [SAGEBRUSH_SOUND],
      qloo: () =>
        createQlooClient({
          apiKey: "k",
          cache,
          fetch: counted.fetch,
          prefix: PREFIX,
        }),
      model: () => scriptedPlanner().model,
      store,
      budget: counted,
      clock: () => now,
    });
    expect(runs[0].calls).toBeGreaterThan(0);
    expect(runs[0].ms).toBe(10 * runs[0].calls);
  });
});

describe("the towns a re-run takes (TOWNS)", () => {
  const DEMO = ["Boise", "Austin", "Denver", "Nashville"];
  const cities = (towns: readonly { city: string }[]) =>
    towns.map((town) => town.city);

  it("takes the four demo towns by default, every checked town with all, demo towns first, or the towns named", () => {
    expect(cities(pickTowns(CHECKED_TOWNS, DEMO, undefined))).toEqual(
      cities(CHECKED_TOWNS.filter((town) => DEMO.includes(town.city))),
    );
    const all = pickTowns(CHECKED_TOWNS, DEMO, "all");
    expect(all).toHaveLength(CHECKED_TOWNS.length);
    expect(cities(all.slice(0, 4)).sort()).toEqual([...DEMO].sort());
    expect(cities(pickTowns(CHECKED_TOWNS, DEMO, "Denver"))).toEqual([
      "Denver",
    ]);
    expect(cities(pickTowns(CHECKED_TOWNS, DEMO, "Austin,Boise"))).toEqual([
      "Austin",
      "Boise",
    ]);
  });

  it("refuses a town that isn't checked", () => {
    expect(() => pickTowns(CHECKED_TOWNS, DEMO, "Atlantis")).toThrow(
      /Atlantis/,
    );
  });
});
