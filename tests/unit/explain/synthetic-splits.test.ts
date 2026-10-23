// WS7 part (b), step 2: synthetic mode's seeded cache holds an invented Qloo split for each
// synthetic build, so the e2e reads the card lines the way production reads its cached ones.
// Invented shares (tests/e2e/synthetic-build.ts); the seed fetches nothing from the network.
import { describe, expect, it } from "vitest";
import { attributionFor } from "@/server/attribution";
import { createMemoryCache } from "@/server/qloo-cache";
import { seedSynthetic } from "@/server/synthetic-seed";
import {
  syntheticSavedBuild,
  syntheticTownBuild,
} from "../../e2e/synthetic-build";

describe("the synthetic seed's invented split (WS7 part b)", () => {
  it("gives every act of the synthetic build a split, without the venue Qloo has no fan data for", async () => {
    const cache = createMemoryCache();
    await seedSynthetic(cache, { savedBuild: true });
    const build = syntheticSavedBuild();
    const splits = await attributionFor(build, cache);

    expect(Object.keys(splits).sort()).toEqual(
      build.lineup.acts.map((act) => act.entityId).sort(),
    );
    for (const split of Object.values(splits)) {
      expect(split.venues).toBe(2);
      expect(split.parts.map((part) => part.name)).not.toContain(
        "Cottonwood Social Hall",
      );
      const total = split.parts.reduce((sum, part) => sum + part.share, 0);
      expect(Math.abs(total - 1)).toBeLessThan(0.01);
    }
    // As in the real answers, the venue a card credits isn't always the larger share.
    const leansElsewhere = build.lineup.acts.filter((act) => {
      const venues = splits[act.entityId].parts
        .filter((part) => part.input === "venue")
        .sort((a, b) => b.share - a.share);
      return venues[0].entityId !== act.anchorVenue.entityId;
    });
    expect(leansElsewhere.length).toBeGreaterThan(0);
    expect(leansElsewhere.length).toBeLessThan(build.lineup.acts.length);
  });

  it("covers the town copies too, Nashville's switch build with its own venue", async () => {
    const cache = createMemoryCache();
    await seedSynthetic(cache, { savedBuild: true });
    for (const [slug, festivalId] of [
      ["austin", "sagebrush-sound-austin"],
      ["nashville", "sagebrush-sound-nashville"],
    ])
      expect(
        Object.keys(
          await attributionFor(syntheticTownBuild(slug, festivalId), cache),
        ),
      ).toHaveLength(10);
  });

  it("holds no split with the empty seed", async () => {
    const cache = createMemoryCache();
    await seedSynthetic(cache, { savedBuild: false });
    expect(await attributionFor(syntheticSavedBuild(), cache)).toEqual({});
  });
});
