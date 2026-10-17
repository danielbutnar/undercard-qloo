import { describe, expect, it } from "vitest";
import { BuildEventSchema } from "@/lib/build-events";
import {
  climbAfter,
  climbBaseline,
  CLIMB_SHOWN,
  playClimbs,
} from "@/lib/lift-climb";

const artist = (n: number, popularity = 0.85) => ({
  entityId: `id-${n}`,
  name: `Act ${n}`,
  popularity,
  affinity: 0.9,
  tags: [],
});
const MID = {
  id: "mid" as const,
  label: "Mid",
  slots: 4,
  minPopularity: 0.8,
  maxPopularity: 0.92,
};
const NEUROLUX = { entityId: "v1", name: "Venue 227" };

describe("the climb (M9a)", () => {
  const baseline = Array.from({ length: 30 }, (_, i) => artist(i + 1));

  it("starts from the headliners-only list, top first", () => {
    const step = climbBaseline("mid", baseline);
    expect(step.venue).toBeNull();
    expect(step.acts).toHaveLength(CLIMB_SHOWN);
    expect(step.acts[0]).toEqual({
      entityId: "id-1",
      name: "Act 1",
      move: null,
    });
    expect(BuildEventSchema.parse(step)).toEqual(step);
  });

  it("re-sorts by a venue's ranking and labels each act it lifts with the real move", () => {
    // The venue's list puts act 9 first (up 8 places) and act 20 second (up 18).
    const run = [
      artist(9),
      artist(20),
      ...baseline.filter(
        (a) => a.entityId !== "id-9" && a.entityId !== "id-20",
      ),
    ];
    const step = climbAfter("mid", MID, NEUROLUX, baseline, run);
    expect(step.venue).toEqual(NEUROLUX);
    expect(step.acts[0]).toEqual({ entityId: "id-9", name: "Act 9", move: 8 });
    expect(step.acts[1]).toEqual({
      entityId: "id-20",
      name: "Act 20",
      move: 18,
    });
    // Act 1 slipped two places: no label, only lifts of 5 or more are moves.
    expect(step.acts.find((a) => a.entityId === "id-1")?.move).toBeNull();
  });

  it("doesn't label an act outside the band's popularity range", () => {
    const run = [artist(25, 0.95), ...baseline];
    const step = climbAfter("mid", MID, NEUROLUX, baseline, run);
    expect(step.acts[0].move).toBeNull();
  });
});

describe("playing the climb", () => {
  it("holds each step long enough to watch, and a venue step longer than the first list", () => {
    const steps = [
      { type: "climb" as const, band: "mid" as const, venue: null, acts: [] },
      {
        type: "climb" as const,
        band: "mid" as const,
        venue: NEUROLUX,
        acts: [],
      },
    ];
    const plan = playClimbs(steps);
    expect(plan.map((p) => p.holdMs)).toEqual([900, 1800]);
    expect(plan.reduce((sum, p) => sum + p.holdMs, 0)).toBeLessThan(10_000);
  });
});
