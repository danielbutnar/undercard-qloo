// WS7 part (a), step 2: each lineup act's split for a saved build, read from the Qloo cache only
// through a client whose fetch throws, as src/server/pick-checks.ts reads its checks. Invented
// build, names and shares (./invented.ts), an in-memory cache.
import { describe, expect, it, vi } from "vitest";
import type { SplitPart } from "@/lib/attribution-line";
import { attributionFor, explainCalls } from "@/server/attribution";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { fakeFetch, syntheticId } from "../m2/fake-qloo";
import {
  DINER,
  FORT,
  HOLLOW_PINES,
  inventedBuild,
  inventedExplainQloo,
  LANTERN,
  MID_ACTS,
  OPENER_ACTS,
  QUIET_ONES,
} from "./invented";

/** Caches section 35's answers for the given ranges, as a live call through the app would. */
async function cached(
  ranges: ("mid" | "opener")[],
  route: (url: URL) => unknown = inventedExplainQloo,
) {
  const memory = createMemoryCache();
  const keys: string[] = [];
  const recording: QlooCache = {
    kind: "memory",
    get: (key) => memory.get(key),
    set: async (key, value, ttl) => {
      keys.push(key);
      await memory.set(key, value, ttl);
    },
  };
  const fake = fakeFetch(route);
  const seeding = createQlooClient({
    apiKey: "test-key",
    cache: recording,
    fetch: fake.fetch,
  });
  for (const call of explainCalls(inventedBuild()))
    if (ranges.includes(call.band as "mid" | "opener"))
      await seeding.explain(call);
  // The read may only read: a write would mean it fetched something.
  const sets = vi.fn();
  const readOnly: QlooCache = {
    kind: "memory",
    get: (key) => memory.get(key),
    set: async (...args) => void sets(...args),
  };
  return { memory, keys, readOnly, sets, requests: fake.requests };
}

const headliner = (
  entityId: string,
  name: string,
  share: number,
): SplitPart => ({
  input: "headliner",
  entityId,
  name,
  share,
});
const venue = (entityId: string, name: string, share: number): SplitPart => ({
  input: "venue",
  entityId,
  name,
  share,
});

describe("the calls a saved build's split needs (WS7 step 2)", () => {
  it("makes one call per fee range: the headliners then that range's venues, its acts, the ages", () => {
    expect(explainCalls(inventedBuild())).toEqual([
      {
        band: "mid",
        signalEntityIds: [HOLLOW_PINES, QUIET_ONES, LANTERN, FORT, DINER],
        actIds: MID_ACTS,
        ages: ["25_to_29", "30_to_34"],
      },
      {
        band: "opener",
        signalEntityIds: [HOLLOW_PINES, QUIET_ONES, LANTERN, FORT],
        actIds: OPENER_ACTS,
        ages: ["25_to_29", "30_to_34"],
      },
    ]);
  });

  it("sends no age for a build saved without one, and skips a range with no acts or no venues", () => {
    const build = inventedBuild();
    const noAges = inventedBuild({
      context: { ...build.context, ages: undefined },
    });
    expect(explainCalls(noAges).map((call) => call.ages)).toEqual([[], []]);

    const noOpeners = inventedBuild({
      lineup: {
        ...build.lineup,
        acts: build.lineup.acts.filter((act) => act.band === "mid"),
      },
    });
    expect(explainCalls(noOpeners).map((call) => call.band)).toEqual(["mid"]);

    const noMidVenues = inventedBuild({
      context: {
        ...build.context,
        anchors: { opener: build.context.anchors.opener },
      },
    });
    expect(explainCalls(noMidVenues).map((call) => call.band)).toEqual([
      "opener",
    ]);
  });
});

describe("each act's split, from the Qloo cache alone (WS7 step 2)", () => {
  it("names each input as the build does, keeps Qloo's order, and leaves out an input with no share", async () => {
    const { readOnly, sets, requests } = await cached(["mid", "opener"]);
    const before = requests.length;

    const splits = await attributionFor(inventedBuild(), readOnly);

    expect(Object.keys(splits).sort()).toEqual(
      [...MID_ACTS, ...OPENER_ACTS].sort(),
    );
    // Invented Act 1003: Lantern 0.4, Hollow Pines 0.3, The Quiet Ones 0.2, Fort 0.1. The
    // mid-size call sent three venues and Qloo scored two of them (the Diner for no act).
    expect(splits[syntheticId(1003)]).toEqual({
      venues: 2,
      parts: [
        venue(LANTERN, "The Lantern Room", 0.4),
        headliner(HOLLOW_PINES, "Hollow Pines", 0.3),
        headliner(QUIET_ONES, "The Quiet Ones", 0.2),
        venue(FORT, "Fort Street Ballroom", 0.1),
      ],
    });
    expect(splits[syntheticId(2001)].venues).toBe(2);
    // The Diner was in the mid-size call, but no act got a share from it.
    for (const { parts } of Object.values(splits))
      expect(parts.map((part) => part.entityId)).not.toContain(DINER);
    expect(requests.length).toBe(before);
    expect(sets).not.toHaveBeenCalled();
  });

  it("counts only the range's venues Qloo scored for some act as in the split", async () => {
    // Qloo scores no act on The Lantern Room in the opening range, as it found no Diner in
    // section 35's: one venue left in that range's split.
    const { readOnly } = await cached(["mid", "opener"], (url) => {
      const body = inventedExplainQloo(url) as {
        results: {
          entities: {
            query: {
              explainability: {
                "signal.interests.entities": { entity_id: string }[];
              };
            };
          }[];
        };
      };
      if (url.searchParams.get("take") === "6")
        for (const act of body.results.entities) {
          const list = act.query.explainability;
          list["signal.interests.entities"] = list[
            "signal.interests.entities"
          ].filter((share) => share.entity_id !== LANTERN);
        }
      return body;
    });
    const splits = await attributionFor(inventedBuild(), readOnly);
    expect(splits[syntheticId(1001)].venues).toBe(2);
    expect(splits[syntheticId(2001)].venues).toBe(1);
  });

  it("gives a range the cache doesn't hold no split, never an error", async () => {
    const midOnly = await cached(["mid"]);
    const splits = await attributionFor(inventedBuild(), midOnly.readOnly);
    expect(Object.keys(splits).sort()).toEqual([...MID_ACTS].sort());

    const none = await cached([]);
    await expect(
      attributionFor(inventedBuild(), none.readOnly),
    ).resolves.toEqual({});
    expect(none.sets).not.toHaveBeenCalled();
  });

  it("never calls Qloo, even with nothing cached and the network open", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("must not fetch");
    });
    vi.stubGlobal("fetch", fetch);
    try {
      await expect(
        attributionFor(inventedBuild(), createMemoryCache()),
      ).resolves.toEqual({});
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("gives no split to an act Qloo scored nothing for, or scored on an input the call didn't send", async () => {
    const stranger = syntheticId(999);
    const { readOnly } = await cached(["mid"], (url) => {
      const body = inventedExplainQloo(url) as {
        results: { entities: Record<string, unknown>[] };
      };
      const [first, second, third, ...rest] = body.results.entities;
      return {
        ...body,
        results: {
          entities: [
            { ...first, query: { affinity: 0.9 } },
            {
              ...second,
              query: {
                affinity: 0.9,
                explainability: {
                  "signal.interests.entities": [
                    { entity_id: HOLLOW_PINES, score: 0.6 },
                    { entity_id: stranger, score: 0.4 },
                  ],
                },
              },
            },
            third,
            ...rest,
            // An act outside the range's lineup is ignored.
            { ...third, entity_id: syntheticId(3001) },
          ],
        },
      };
    });

    const splits = await attributionFor(inventedBuild(), readOnly);
    expect(Object.keys(splits).sort()).toEqual(
      [syntheticId(1003), syntheticId(1004)].sort(),
    );
  });

  it("gives a range no split when its cached value isn't a split", async () => {
    const { memory, keys, readOnly } = await cached(["mid", "opener"]);
    expect(keys).toHaveLength(2);
    await memory.set(keys[0], { not: "a split" }, 60);
    await memory.set(keys[1], [{ entityId: 7, shares: "none" }], 60);
    await expect(attributionFor(inventedBuild(), readOnly)).resolves.toEqual(
      {},
    );
  });
});
