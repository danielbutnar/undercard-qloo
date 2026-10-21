import { describe, expect, it } from "vitest";
import { billPlaces } from "@/lib/places";
import type { Act } from "@/lib/lineup";

// Invented acts: the place now and before come from the saved reason and the band's ranking.
const act = (entityId: string, band: Act["band"], reason: string): Act => ({
  entityId,
  name: entityId,
  band,
  affinity: 0.8,
  popularity: band === "mid" ? 0.85 : 0.6,
  anchorVenue: { entityId: "room", name: "The Room" },
  reason,
  sharedTags: [
    { id: "urn:tag:genre:music:a", name: "A" },
    { id: "urn:tag:genre:music:b", name: "B" },
  ],
});

describe("an act's places on the chart", () => {
  it("reads the climb from the saved reason and the place before from the band's ranking", () => {
    const places = billPlaces(
      [
        act("up", "mid", "The Room fans move it up 15 places."),
        act("new", "opener", "The Room fans move it into the top 29."),
      ],
      {
        mid: [...Array.from({ length: 18 }, (_, i) => `f${i}`), "up"],
        opener: ["x"],
      },
    );
    // 19th for the headliners alone, up 15: 4th now.
    expect(places.up).toEqual({ now: 4, was: 19 });
    expect(places.new).toEqual({ now: 29, was: null });
  });

  it("leaves out an act whose places the build can't tell", () => {
    const places = billPlaces(
      [
        act("odd", "mid", "Chosen by hand."),
        act("gone", "mid", "The Room fans move it up 3 places."),
      ],
      { mid: [] },
    );
    expect(places).toEqual({});
  });
});
