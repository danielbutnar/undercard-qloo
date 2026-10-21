// The lab's climb rows: a venue's re-sort as the eight it lists, plus the acts it put on the bill
// from further down, every number taken from the saved build.
import { describe, expect, it } from "vitest";
import { climbRows, noteBefore, stepCall } from "@/app/lab/_kit/climb-rows";
import type { TraceCall } from "@/lib/build-events";
import type { FeeBand } from "@/lib/fee-bands";
import type { ClimbEvent } from "@/lib/lift-climb";
import type { Act } from "@/lib/lineup";

const VENUE = { entityId: "venue-lantern", name: "The Lantern Room" };
const OTHER = { entityId: "venue-fort", name: "Fort Street Ballroom" };

const act = (entityId: string, reason: string, venue = VENUE): Act => ({
  entityId,
  name: entityId,
  band: "opener",
  affinity: 0.9,
  popularity: 0.7,
  anchorVenue: venue,
  reason,
  sharedTags: [
    { id: "urn:tag:genre:music:a", name: "A" },
    { id: "urn:tag:genre:music:b", name: "B" },
  ],
});

const step: ClimbEvent = {
  type: "climb",
  band: "opener",
  venue: VENUE,
  acts: [
    { entityId: "listed", name: "listed", move: null },
    { entityId: "climber", name: "climber", move: 6 },
    { entityId: "booked-here", name: "booked-here", move: 9 },
    { entityId: "booked-elsewhere", name: "booked-elsewhere", move: null },
  ],
};

const bill = [
  act("booked-here", "The Lantern Room fans move it up 9 places."),
  act(
    "booked-elsewhere",
    "Fort Street Ballroom fans move it up 7 places.",
    OTHER,
  ),
  act("deep", "The Lantern Room fans move it up 30 places."),
  act("deep-new", "The Lantern Room fans move it into the top 29."),
];
const places = {
  "booked-here": { was: 12, now: 3 },
  "booked-elsewhere": { was: 11, now: 4 },
  deep: { was: 45, now: 15 },
  "deep-new": { was: null, now: 29 },
};

describe("climb rows", () => {
  it("lists the step's acts at their places, with where the climbers were", () => {
    const rows = climbRows(step, bill, places);
    expect(
      rows.slice(0, 4).map(({ place, move, was }) => ({ place, move, was })),
    ).toEqual([
      { place: 1, move: null, was: null },
      { place: 2, move: 6, was: 8 },
      { place: 3, move: 9, was: 12 },
      { place: 4, move: null, was: null },
    ]);
  });

  it("marks only the acts this venue's fans put on the bill", () => {
    const onBill = climbRows(step, bill, places).filter((row) => row.onBill);
    expect(onBill.map((row) => row.entityId)).toEqual([
      "booked-here",
      "deep",
      "deep-new",
    ]);
  });

  it("adds this venue's acts from further down at their own places, a new entry included", () => {
    const deep = climbRows(step, bill, places).filter((row) => row.deep);
    expect(deep).toEqual([
      expect.objectContaining({
        entityId: "deep",
        place: 15,
        move: 30,
        was: 45,
        fresh: false,
      }),
      expect.objectContaining({
        entityId: "deep-new",
        place: 29,
        move: null,
        was: null,
        fresh: true,
      }),
    ]);
  });

  it("puts nothing on the bill from the headliners-only list", () => {
    const baseline: ClimbEvent = { ...step, venue: null };
    const rows = climbRows(baseline, bill, places);
    expect(
      rows.some((row) => row.onBill || row.move !== null || row.deep),
    ).toBe(false);
  });
});

describe("the call behind a step", () => {
  const bands: FeeBand[] = [
    {
      id: "mid",
      label: "Mid",
      minPopularity: 0.8,
      maxPopularity: 0.92,
      slots: 4,
    },
    {
      id: "opener",
      label: "Opener",
      minPopularity: 0.55,
      maxPopularity: 0.8,
      slots: 6,
    },
  ];
  const call = (n: number, tool: string, summary: string): TraceCall => ({
    n,
    tool,
    endpoint: "/v2/insights",
    summary,
    params: [],
    resultCount: 50,
    ms: 10,
    cached: true,
  });
  const calls = [
    call(6, "baseline_artists", "Opener-band artists for the headliners alone"),
    call(
      7,
      "venue_artists",
      "Mid-band artists for the headliners and The Lantern Room",
    ),
    call(
      8,
      "venue_artists",
      "Opener-band artists for the headliners and The Lantern Room",
    ),
  ];

  it("matches the band and the venue named in the call", () => {
    expect(stepCall(step, calls, bands)?.n).toBe(8);
    expect(stepCall({ ...step, venue: null }, calls, bands)?.n).toBe(6);
  });

  it("names the planner's latest line said before that call", () => {
    const notes = [
      { at: 4, text: "Anchors first." },
      { at: 7, text: "Try the next room." },
    ];
    expect(noteBefore(7, notes)).toBe("Anchors first.");
    expect(noteBefore(8, notes)).toBe("Try the next room.");
    expect(noteBefore(3, notes)).toBeNull();
  });
});
