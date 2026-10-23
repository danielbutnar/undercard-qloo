// WS11 (Daniel's brief of 2026-10-22), step 3: the Without Qloo counts per town and across the
// 29 towns (picks, found on Qloo, in, above and below the fee range, two genres shared, climbs,
// all three) and the review's measures, read from the store with no write, no Qloo call and no
// model call (the saved model answers, then each pick's cached search and the build's cached
// lists, as section 31's dry run reads them), or from the raw files section 31's run left under
// .design/with-without-qloo/ when there is no store. The run's own record (model calls,
// searches) comes from those files only. Invented data throughout.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluate,
  loadEvidence,
  withoutFromRaw,
  withoutFromStore,
  type Computation,
  type EvidenceData,
} from "../../../scripts/evidence-check";
import {
  createMemoryCache,
  createQlooCache,
  SYNTHETIC_ENV,
  type QlooCache,
} from "@/server/qloo-cache";

/** The synthetic server's cache: Boise's build, its model answer and the picks' searches. */
const synthetic = () => createQlooCache({ [SYNTHETIC_ENV]: "1" });

/** A cache that counts reads and refuses every write. */
function watched(cache: QlooCache) {
  const seen = { gets: 0, sets: 0 };
  const wrapped: QlooCache = {
    kind: cache.kind,
    get: async <T>(key: string) => {
      seen.gets++;
      return cache.get<T>(key);
    },
    set: async () => {
      seen.sets++;
      throw new Error("a write");
    },
  };
  return { cache: wrapped, seen };
}

/** Where the Without Qloo counts came from, or why there are none. */
const sourceOf = ({ without }: EvidenceData) =>
  without === null
    ? null
    : "missing" in without
      ? without.missing
      : without.source;

const on = (data: Partial<EvidenceData>): EvidenceData => ({
  towns: [],
  without: null,
  run: null,
  ...data,
});

describe("the Without Qloo counts from the store", () => {
  it("count each measured town's picks against the three tests, reading only", async () => {
    const { cache, seen } = watched(synthetic());
    const without = await withoutFromStore(cache);
    // Only Boise has a saved model answer in the synthetic store; no model is asked for others.
    expect(without.towns.map((town) => town.festivalId)).toEqual([
      "sagebrush-sound",
    ]);
    expect(without.towns[0]).toMatchObject({
      rebuilt: true,
      counts: {
        picks: 10,
        found: 8,
        inRange: 3,
        above: 4,
        below: 1,
        twoGenres: 4,
        climbs: 1,
        allThree: 1,
      },
    });
    expect(seen.gets).toBeGreaterThan(0);
    expect(seen.sets).toBe(0);
  });

  it("give the totals, the towns with a count and the most in one town", async () => {
    const data = on({ without: await withoutFromStore(synthetic()) });
    const value = (computation: Computation) => evaluate(computation, data);
    expect(value({ kind: "without", count: "towns" })).toBe(1);
    expect(value({ kind: "without", count: "rebuilt" })).toBe(1);
    expect(value({ kind: "without", count: "picks" })).toBe(10);
    expect(value({ kind: "without", count: "above" })).toBe(4);
    expect(value({ kind: "without-towns", count: "allThree", equal: 0 })).toBe(
      0,
    );
    expect(value({ kind: "without-most", count: "allThree" })).toBe(1);
  });

  it("give the review's measures over each town's two lineups", async () => {
    const data = on({ without: await withoutFromStore(synthetic()) });
    const value = (computation: Computation) => evaluate(computation, data);
    // The synthetic picks are other invented acts than the synthetic lineup's.
    expect(value({ kind: "measure", of: "towns-sharing-no-act" })).toBe(1);
    expect(value({ kind: "measure", of: "towns-changed-seven" })).toBe(1);
    expect(value({ kind: "measure", of: "distinct-with" })).toBe(10);
    // Eight found by their Qloo ids, the unfound and the unsearched pick by their names.
    expect(value({ kind: "measure", of: "distinct-without" })).toBe(10);
    expect(value({ kind: "measure", of: "average-changed" })).toBe(10);
    // The exact counts the data file carries since Duluth's shared act was found (2026-10-22).
    expect(value({ kind: "measure", of: "shared-acts" })).toBe(0);
    expect(value({ kind: "measure", of: "towns-sharing-an-act" })).toBe(0);
  });

  it("leave a town out when its build's lists aren't in the cache", async () => {
    // The synthetic answer and build, without the Qloo answers its lists come from.
    const source = synthetic();
    const bare = createMemoryCache();
    for (const key of [
      "undercard:build:v1:latest:sagebrush-sound",
      "undercard:llm-only:v2:sagebrush-sound",
    ]) {
      const value = await source.get<unknown>(key);
      await bare.set(key, value, 60);
      if (typeof value === "string") {
        const build = await source.get<unknown>(
          `undercard:build:v1:id:${value}`,
        );
        await bare.set(`undercard:build:v1:id:${value}`, build, 60);
      }
    }
    const without = await withoutFromStore(bare);
    expect(without.towns).toHaveLength(1);
    expect(without.towns[0]).toMatchObject({ rebuilt: false, counts: {} });
    const data = on({ without });
    expect(evaluate({ kind: "without", count: "rebuilt" }, data)).toBe(0);
    expect(evaluate({ kind: "without", count: "picks" }, data)).toBe(0);
  });
});

describe("a store that doesn't answer", () => {
  // Like createUpstashCache: get reads an outage as a miss; getOrThrow says it failed.
  const down: QlooCache = {
    kind: "upstash",
    get: async () => null,
    getOrThrow: async () => {
      throw new Error("network down");
    },
    set: async () => {},
  };

  it("fails the read instead of counting its towns as unbuilt", async () => {
    await expect(withoutFromStore(down)).rejects.toThrow(/network down/);
  });

  it("leaves every Without Qloo claim without data, saying why", async () => {
    const data = await loadEvidence({
      base: "http://synthetic.test",
      fetch: async () => new Response("", { status: 503 }),
      store: down,
      design: null,
    });
    expect(evaluate({ kind: "without", count: "picks" }, data)).toEqual({
      missing: "the store didn't answer: network down",
    });
    expect(evaluate({ kind: "measure", of: "distinct-with" }, data)).toEqual({
      missing: "the store didn't answer: network down",
    });
  });
});

describe("the Without Qloo counts from section 31's raw files", () => {
  function rawDir() {
    const dir = mkdtempSync(join(tmpdir(), "evidence-check-"));
    mkdirSync(join(dir, "with-without-qloo"));
    writeFileSync(
      join(dir, "with-without-qloo", "result.json"),
      JSON.stringify({
        ranAt: "2026-10-21T15:46:36.467Z",
        modelCalls: 2,
        searches: 7,
        searchAttempts: 8,
        rows: [
          {
            festival: "a",
            rebuilt: true,
            answerSaved: true,
            qlooActs: 10,
            qlooAllThree: 10,
            picks: 10,
            searched: 10,
            found: 9,
            inFeeRange: 2,
            twoGenres: 8,
            climbs: 1,
            allThree: 1,
          },
          {
            festival: "b",
            rebuilt: true,
            answerSaved: false,
            qlooActs: 10,
            qlooAllThree: 10,
            picks: 10,
            searched: 10,
            found: 7,
            inFeeRange: 0,
            twoGenres: 5,
            climbs: 0,
            allThree: 0,
          },
          { festival: "c", rebuilt: false },
        ],
        names: {},
      }),
    );
    writeFileSync(
      join(dir, "with-without-qloo", "measures.json"),
      JSON.stringify({
        aggregate: {},
        changed: [10, 9],
        towns: [
          { festival: "a", with: ["A1", "A2"], without: ["X1", "X2"] },
          {
            festival: "b",
            with: ["B1", "B2"],
            without: ["B1", "name:somebody"],
          },
        ],
      }),
    );
    return dir;
  }

  it("read each town's counts and the run's record", () => {
    const dir = rawDir();
    const { without, run } = withoutFromRaw(dir);
    expect(without?.source).toContain(join(dir, "with-without-qloo"));
    const data = on({ without, run });
    const value = (computation: Computation) => evaluate(computation, data);
    expect(value({ kind: "without", count: "towns" })).toBe(3);
    expect(value({ kind: "without", count: "rebuilt" })).toBe(2);
    expect(value({ kind: "without", count: "found" })).toBe(16);
    expect(value({ kind: "without", count: "inRange" })).toBe(2);
    expect(value({ kind: "without-towns", count: "allThree", equal: 0 })).toBe(
      1,
    );
    // The run's files predate the above/below split: only the store can say.
    expect(value({ kind: "without", count: "above" })).toEqual({
      missing: "the raw files don't hold above; read the store",
    });
    expect(value({ kind: "measure", of: "towns-sharing-no-act" })).toBe(1);
    expect(value({ kind: "measure", of: "distinct-without" })).toBe(4);
    expect(value({ kind: "run", of: "model-calls" })).toBe(2);
    expect(value({ kind: "run", of: "searches" })).toBe(7);
    expect(value({ kind: "run", of: "search-retries" })).toBe(1);
    expect(value({ kind: "run", of: "answers-saved" })).toBe(1);
    expect(value({ kind: "run", of: "answers-asked" })).toBe(1);
  });

  it("say there's nothing to read when the files aren't there", () => {
    const { without, run } = withoutFromRaw(
      join(tmpdir(), "no-such-design-dir"),
    );
    expect(without).toBeNull();
    expect(run).toBeNull();
    const data = on({});
    expect(evaluate({ kind: "without", count: "picks" }, data)).toEqual({
      missing:
        "no Without Qloo data: no store and no .design/with-without-qloo/",
    });
    expect(evaluate({ kind: "run", of: "model-calls" }, data)).toEqual({
      missing:
        "no run record: .design/with-without-qloo/result.json wasn't read",
    });
  });

  it("are read only when there is no store, while the run's record always comes from them", async () => {
    const dir = rawDir();
    const fromStore = await loadEvidence({
      base: "http://synthetic.test",
      fetch: async () => new Response("", { status: 503 }),
      store: synthetic(),
      design: dir,
    });
    expect(sourceOf(fromStore)).toBe("the store, read-only");
    expect(fromStore.run?.modelCalls).toBe(2);
    const fromRaw = await loadEvidence({
      base: "http://synthetic.test",
      fetch: async () => new Response("", { status: 503 }),
      store: null,
      design: dir,
    });
    expect(sourceOf(fromRaw)).toContain("with-without-qloo");
    expect(
      fromRaw.towns.every((town) => town.replay.error === "HTTP 503"),
    ).toBe(true);
  });
});
