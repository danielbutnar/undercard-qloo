// WS13 item 10: credit and split. On the cards whose credited venue isn't Qloo's largest venue
// share (44 of 290 in evidence 35), a cache-only count by town and tier, and two wordings for
// Daniel: (a) one clause saying why, (b) the credit following the split. Invented data only.
import { describe, expect, it } from "vitest";
import type { ActSplit } from "@/lib/attribution-line";
import {
  creditAgainstSplit,
  creditClause,
  creditCounts,
  splitCredit,
} from "@/lib/credit-split";
import type { Act } from "@/lib/lineup";

const act = (entityId: string, band: "mid" | "opener", venue: string): Act => ({
  entityId,
  name: entityId.toUpperCase(),
  band,
  affinity: 0.9,
  popularity: 0.85,
  anchorVenue: { entityId: venue, name: venue === "nx" ? "Venue 227" : "V418" },
  reason: "Venue 227 fans move it up 15 places.",
  sharedTags: [
    { id: "urn:tag:genre:music:dream_pop", name: "Dream Pop" },
    { id: "urn:tag:genre:music:indie_rock", name: "Indie Rock" },
  ],
});
const split = (shares: Record<string, number>): ActSplit => ({
  venues: Object.keys(shares).filter((id) => id !== "h").length,
  parts: Object.entries(shares).map(([entityId, share]) => ({
    input: entityId === "h" ? "headliner" : "venue",
    entityId,
    name: entityId === "nx" ? "Venue 227" : entityId === "vac" ? "V418" : "Them",
    share,
  })),
});

describe("credit against Qloo's split (WS13.10)", () => {
  it("agrees when the credited venue has Qloo's largest venue share", () => {
    expect(
      creditAgainstSplit(
        act("a", "mid", "nx"),
        split({ h: 0.6, nx: 0.3, vac: 0.1 }),
      ),
    ).toMatchObject({ agrees: true, largest: { entityId: "nx" } });
  });

  it("disagrees when another venue has the largest share, and names it", () => {
    expect(
      creditAgainstSplit(
        act("a", "mid", "nx"),
        split({ h: 0.6, nx: 0.1, vac: 0.3 }),
      ),
    ).toMatchObject({
      agrees: false,
      largest: { entityId: "vac", name: "V418" },
    });
  });

  it("can't say when no venue has a share, and counts a tie as agreeing", () => {
    expect(
      creditAgainstSplit(act("a", "mid", "nx"), split({ h: 1 })).agrees,
    ).toBeNull();
    expect(
      creditAgainstSplit(
        act("a", "mid", "nx"),
        split({ h: 0.5, nx: 0.25, vac: 0.25 }),
      ).agrees,
    ).toBe(true);
  });

  it("counts the cards by town and tier: on the lineup, with a split, crediting another venue than Qloo's largest share", () => {
    const counts = creditCounts([
      {
        town: "Larkspur",
        acts: [
          act("a", "mid", "nx"),
          act("b", "mid", "nx"),
          act("c", "opener", "vac"),
          act("d", "opener", "vac"),
        ],
        splits: {
          a: split({ h: 0.6, nx: 0.3, vac: 0.1 }),
          b: split({ h: 0.6, nx: 0.1, vac: 0.3 }),
          c: split({ h: 0.6, nx: 0.3, vac: 0.1 }),
        },
      },
    ]);
    expect(counts).toEqual({
      total: { cards: 4, withSplit: 3, disagree: 2 },
      byTown: { Larkspur: { cards: 4, withSplit: 3, disagree: 2 } },
      byTier: {
        mid: { cards: 2, withSplit: 2, disagree: 1 },
        opener: { cards: 2, withSplit: 1, disagree: 1 },
      },
    });
  });
});

describe("the two wordings for Daniel (WS13.10)", () => {
  const credited = act("a", "mid", "nx");
  const largest = { entityId: "vac", name: "V418" };

  it("(a) keeps the credit and says why in one clause", () => {
    expect(creditClause(credited, largest)).toBe(
      "The card credits Venue 227 because its fans alone moved this act most; with the venues asked together, Qloo traces more of its match to V418.",
    );
  });

  it("(b) moves the credit to Qloo's largest venue share, and keeps the climb's venue", () => {
    expect(splitCredit(credited, largest)).toBe(
      "Credited to V418, the venue Qloo's split leans on most; its climb came with Venue 227's fans added.",
    );
  });
});

describe("the cache-only count over saved builds (WS13.10)", () => {
  it("reads each build's split from the cache, never Qloo, and counts the cards crediting another venue", async () => {
    const { createMemoryCache } = await import("@/server/qloo-cache");
    const { seedSynthetic } = await import("@/server/synthetic-seed");
    const { readOnlyCache } = await import("@/server/attribution-warm");
    const { creditReport } = await import("@/server/credit-split");
    const { syntheticSavedBuild } = await import("../../e2e/synthetic-build");
    const cache = createMemoryCache();
    await seedSynthetic(cache, { savedBuild: true });
    const build = syntheticSavedBuild();
    const { counts, cards } = await creditReport(
      [build],
      readOnlyCache(cache),
      () => "Boise",
    );
    expect(counts.total.cards).toBe(10);
    expect(counts.total.withSplit).toBe(10);
    // The synthetic split leans elsewhere for some cards, as the real answers do.
    expect(counts.total.disagree).toBeGreaterThan(0);
    expect(counts.total.disagree).toBeLessThan(10);
    expect(cards).toHaveLength(counts.total.disagree);
    expect(counts.byTown.Boise).toEqual(counts.total);
    for (const card of cards) expect(card.largest.name).not.toBe(card.credited);
  });
});
