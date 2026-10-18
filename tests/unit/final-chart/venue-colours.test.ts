import { describe, expect, it } from "vitest";
import { VENUE_HUES, venueHues } from "@/lib/venue-colours";
import type { Act } from "@/lib/lineup";

const act = (entityId: string, venueId: string): Act => ({
  entityId,
  name: entityId,
  band: "opener",
  affinity: 0.7,
  popularity: 0.6,
  anchorVenue: { entityId: venueId, name: venueId },
  reason: `${venueId} fans move it up 6 places.`,
  sharedTags: [
    { id: "urn:tag:genre:music:a", name: "A" },
    { id: "urn:tag:genre:music:b", name: "B" },
  ],
});

describe("each venue's colour", () => {
  it("goes to the venue that lifted most acts first, then in the order the agent read them", () => {
    const hues = venueHues(
      [{ entityId: "kf" }, { entityId: "vac" }, { entityId: "nx" }],
      [act("a", "vac"), act("b", "vac"), act("c", "nx")],
    );
    expect(hues.get("vac")).toBe(0);
    expect(hues.get("nx")).toBe(1);
    expect(hues.get("kf")).toBe(2);
  });

  it("covers a venue an act names that the build's list leaves out, and wraps past the palette", () => {
    const venues = Array.from({ length: VENUE_HUES + 1 }, (_, i) => ({
      entityId: `v${i}`,
    }));
    const hues = venueHues(venues, [act("x", "elsewhere")]);
    expect(hues.get("elsewhere")).toBe(0);
    // elsewhere 0, v0 to v4 take 1 to 5, and v5 wraps back to the first colour.
    expect(hues.get("v0")).toBe(1);
    expect(hues.get("v5")).toBe(0);
  });
});
