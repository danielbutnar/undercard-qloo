// The design round's lab: six directions behind /lab, open only under `next dev` on this machine.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAB_DIRECTIONS, labEnabled, labPlaces } from "@/lib/lab";
import type { Act } from "@/lib/lineup";

const act = (
  entityId: string,
  band: "mid" | "opener",
  reason: string,
): Act => ({
  entityId,
  name: entityId,
  band,
  affinity: 0.5,
  popularity: band === "mid" ? 0.85 : 0.6,
  anchorVenue: { entityId: "venue-1", name: "The Lantern Room" },
  reason,
  sharedTags: [
    { id: "urn:tag:genre:music:a", name: "A" },
    { id: "urn:tag:genre:music:b", name: "B" },
  ],
});

describe("the lab is local only", () => {
  it("opens under next dev on this machine", () => {
    expect(labEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is closed in a production build, on Vercel and in tests", () => {
    expect(labEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(labEnabled({ NODE_ENV: "development", VERCEL: "1" })).toBe(false);
    expect(labEnabled({ NODE_ENV: "test" })).toBe(false);
  });

  it("keeps its stills and clips in a git-ignored folder", () => {
    expect(readFileSync(".gitignore", "utf8").split(/\r?\n/)).toContain(
      ".design/",
    );
  });
});

describe("the six directions", () => {
  it("each has a slug, a name, a music-world reference and one sentence for a buyer", () => {
    expect(LAB_DIRECTIONS).toHaveLength(6);
    expect(
      new Set(LAB_DIRECTIONS.map((direction) => direction.slug)).size,
    ).toBe(6);
    for (const direction of LAB_DIRECTIONS) {
      expect(direction.slug).toMatch(/^[a-z][a-z-]*$/);
      expect(direction.name.length).toBeGreaterThan(3);
      expect(direction.reference.length).toBeGreaterThan(10);
      // One sentence: capital first, a single full stop at the end.
      expect(direction.why).toMatch(/^[A-Z][^.]*\.$/);
    }
  });
});

describe("an act's place before and after its venue's fans", () => {
  it("an act a venue lifts: its headliners-only place and its place with the venue added", () => {
    const baseline = [
      "x",
      "y",
      "z",
      "q",
      "w",
      "e",
      "r",
      "t",
      "u",
      "i",
      "o",
      "p",
      "a",
    ];
    const places = labPlaces(
      [act("a", "mid", "The Lantern Room fans move it up 11 places.")],
      {
        mid: baseline,
      },
    );
    // 13th for the headliners' fans alone; 11 places up makes it 2nd.
    expect(places.a).toEqual({ was: 13, now: 2 });
  });

  it("an act new to the ranking: no earlier place, its place from the reason", () => {
    const places = labPlaces(
      [act("b", "opener", "The Lantern Room fans move it into the top 7.")],
      { opener: ["x", "y"] },
    );
    expect(places.b).toEqual({ was: null, now: 7 });
  });

  it("an act missing from its band's ranking has no places", () => {
    const places = labPlaces(
      [act("c", "mid", "The Lantern Room fans move it up 6 places.")],
      {
        mid: ["x"],
      },
    );
    expect(places.c).toEqual({ was: null, now: null });
  });
});
