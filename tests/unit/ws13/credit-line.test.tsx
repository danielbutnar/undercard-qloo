// @vitest-environment jsdom
// WS13 item 10, Daniel's choice of 28 October: on a card whose credited venue has a strictly
// smaller share of Qloo's split than another venue, one line says why the credit stands; on an
// exact tie, nothing. Invented data only.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ActSplit } from "@/lib/attribution-line";
import { creditLine, creditLines } from "@/lib/credit-split";
import type { Act } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { ActCard } from "@/components/act-card";
import { attributionFor, withSplits } from "@/server/attribution";
import { createBuildStore } from "@/server/build-store";
import { createMemoryCache } from "@/server/qloo-cache";
import { seedSynthetic } from "@/server/synthetic-seed";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";

afterEach(cleanup);

const act = (entityId: string, venue: string, name: string): Act => ({
  entityId,
  name: entityId,
  band: "mid",
  affinity: 0.9,
  popularity: 0.85,
  anchorVenue: { entityId: venue, name },
  reason: `${name} fans move it up 15 places.`,
  sharedTags: [
    { id: "urn:tag:genre:music:dream_pop", name: "Dream Pop" },
    { id: "urn:tag:genre:music:indie_rock", name: "Indie Rock" },
  ],
});
const split = (nx: number, vac: number): ActSplit => ({
  venues: 2,
  parts: [
    { input: "headliner", entityId: "h", name: "Them", share: 1 - nx - vac },
    { input: "venue", entityId: "nx", name: "Venue 227", share: nx },
    { input: "venue", entityId: "vac", name: "V418", share: vac },
  ],
});

describe("the credit line (WS13.10, Daniel's wording)", () => {
  it("says why the credit stands, in Daniel's words", () => {
    expect(creditLine(act("a", "nx", "Venue 227"), { name: "V418" })).toBe(
      "Credited to Venue 227: its fans alone lifted this act onto the bill. Asked about all the venues together, Qloo traces more of the match to V418.",
    );
  });

  it("is on a card only where another venue's share is strictly larger, never on a tie", () => {
    const lines = creditLines(
      [
        act("larger", "nx", "Venue 227"),
        act("tie", "nx", "Venue 227"),
        act("own", "nx", "Venue 227"),
      ],
      {
        larger: split(0.1, 0.3),
        tie: split(0.2, 0.2),
        own: split(0.3, 0.1),
      },
    );
    expect(Object.keys(lines)).toEqual(["larger"]);
    expect(lines.larger).toContain("Qloo traces more of the match to V418.");
  });

  it("rides on the first bill's split lines, read from the cache only", async () => {
    const cache = createMemoryCache();
    await seedSynthetic(cache, { savedBuild: true });
    const build = syntheticSavedBuild();
    const raw = await attributionFor(build, cache);
    const expected = creditLines(build.lineup.acts, raw);
    expect(Object.keys(expected).length).toBeGreaterThan(0);
    const bill = await withSplits(
      {
        build: { id: build.id, createdAt: build.createdAt },
        acts: build.lineup.acts,
        calls: build.trace.length,
        placesListed: null,
        anchors: build.context.anchors,
        baselineTop: {},
      },
      SAGEBRUSH_SOUND,
      { store: createBuildStore(cache), cache },
    );
    for (const entry of build.lineup.acts)
      expect(bill?.splits?.[entry.entityId]?.credit).toBe(
        expected[entry.entityId],
      );
  });

  it("is one line in the card body", () => {
    const credit = creditLine(act("a", "nx", "Venue 227"), { name: "V418" });
    render(
      <ActCard
        act={act("a", "nx", "Venue 227")}
        split={{ line: "Qloo traces …", short: "Qloo traces …", credit }}
      />,
    );
    expect(screen.getByText(credit)).toBeTruthy();
  });
});
