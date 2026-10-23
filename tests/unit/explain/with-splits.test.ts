// WS7 part (b), step 1: the first bill carries each saved lineup act's card line on Qloo's split,
// worked out on the server from the build and the Qloo cache only (as withVenueSwitch and
// withFanData are), never a Qloo call. Invented build, names and shares (./invented.ts).
import { describe, expect, it, vi } from "vitest";
import { attributionLine, splitLines } from "@/lib/attribution-line";
import type { FirstBill } from "@/lib/first-bill";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { attributionFor, explainCalls, withSplits } from "@/server/attribution";
import { createBuildStore } from "@/server/build-store";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { fakeFetch, syntheticId } from "../m2/fake-qloo";
import { inventedBuild, inventedExplainQloo, MID_ACTS } from "./invented";

const BUILD = inventedBuild({ festivalId: SAGEBRUSH_SOUND.id });

/** The build saved, its two calls cached as a live call through the app would cache them. */
async function world(ranges: ("mid" | "opener")[] = ["mid", "opener"]) {
  const memory = createMemoryCache();
  await createBuildStore(memory).save(BUILD);
  const seeding = createQlooClient({
    apiKey: "test-key",
    cache: memory,
    fetch: fakeFetch(inventedExplainQloo).fetch,
  });
  for (const call of explainCalls(BUILD))
    if (ranges.includes(call.band as "mid" | "opener"))
      await seeding.explain(call);
  // The read may only read.
  const sets = vi.fn();
  const cache: QlooCache = {
    kind: "memory",
    get: (key) => memory.get(key),
    set: async (...args) => void sets(...args),
  };
  return { cache, store: createBuildStore(cache), sets };
}

const bill = (overrides: Partial<FirstBill> = {}): FirstBill => ({
  build: { id: BUILD.id, createdAt: BUILD.createdAt },
  acts: BUILD.lineup.acts,
  calls: 12,
  placesListed: 8,
  anchors: BUILD.context.anchors,
  baselineTop: { mid: 50, opener: 50 },
  ...overrides,
});

describe("each act's line on Qloo's split, with the first bill (WS7 part b)", () => {
  it("gives each saved lineup act its line and its phone form, from the cache alone", async () => {
    const { cache, store, sets } = await world();
    const fetch = vi.fn(async () => {
      throw new Error("must not fetch");
    });
    vi.stubGlobal("fetch", fetch);
    try {
      const withLines = await withSplits(bill(), SAGEBRUSH_SOUND, {
        store,
        cache,
      });
      const splits = await attributionFor(BUILD, cache);
      expect(withLines?.splits).toEqual(splitLines(splits));
      expect(Object.keys(withLines!.splits!)).toHaveLength(10);
      // Invented Act 1001: the headliners 0.5, Fort Street Ballroom 0.3, The Lantern Room 0.2.
      expect(withLines!.splits![syntheticId(1001)]).toEqual({
        line: "With this fee range's venues together, Qloo traces 50% of this act's match to fans of the headliners, 30% to fans of Fort Street Ballroom and 20% to fans of The Lantern Room.",
        short:
          "With this fee range's venues together, Qloo traces 50% of this act's match to fans of the headliners, 30% to fans of FSB and 20% to fans of The Lantern Room.",
      });
      expect(withLines!.splits![syntheticId(1001)].line).toBe(
        attributionLine(splits[syntheticId(1001)]),
      );
      expect(fetch).not.toHaveBeenCalled();
      expect(sets).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("gives only the acts whose range the cache holds a line", async () => {
    const { cache, store } = await world(["mid"]);
    const withLines = await withSplits(bill(), SAGEBRUSH_SOUND, {
      store,
      cache,
    });
    expect(Object.keys(withLines!.splits!).sort()).toEqual(
      [...MID_ACTS].sort(),
    );
  });

  it("leaves the bill as it was with nothing cached, no saved build, another festival's build or a failed read", async () => {
    const none = await world([]);
    const plain = bill();
    expect(
      await withSplits(plain, SAGEBRUSH_SOUND, {
        store: none.store,
        cache: none.cache,
      }),
    ).toBe(plain);

    const { cache, store } = await world();
    const missing = bill({ build: { id: "no-such-build", createdAt: "" } });
    expect(await withSplits(missing, SAGEBRUSH_SOUND, { store, cache })).toBe(
      missing,
    );

    const elsewhere = { ...SAGEBRUSH_SOUND, id: "somewhere-else" };
    expect(await withSplits(plain, elsewhere, { store, cache })).toBe(plain);

    const broken = {
      byId: async () => {
        throw new Error("the store is down");
      },
    };
    expect(
      await withSplits(plain, SAGEBRUSH_SOUND, { store: broken, cache }),
    ).toBe(plain);

    expect(
      await withSplits(null, SAGEBRUSH_SOUND, { store, cache }),
    ).toBeNull();
  });
});
