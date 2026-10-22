// WS2, no fan data: a venue Qloo had no fan data for is one whose every run in the saved build
// equals its band's headliners-only ranking, entity id for entity id and in order (docs/evidence.md
// section 35 on the evidence branch: Qloo leaves such venues unscored). Invented ids only.
import { describe, expect, it } from "vitest";
import { noFanData } from "@/lib/fan-data";

const HALL = { entityId: "v-1", name: "Lamplight Hall" };
const ROOM = { entityId: "v-2", name: "Owyhee Room" };
const ranked = (...ids: string[]) =>
  ids.map((entityId) => ({
    entityId,
    name: `Act ${entityId}`,
    popularity: 0.8,
    affinity: 0.5,
    tags: [],
  }));
const ids = (...list: string[]) => list.map((entityId) => ({ entityId }));
const baselines = { mid: ids("a", "b", "c", "d"), opener: ids("w", "x", "y") };
const run = (
  venue: typeof HALL,
  band: "mid" | "opener",
  ...list: string[]
) => ({ venue, band, artists: ranked(...list) });

describe("no fan data", () => {
  it("names a venue whose every run equals its band's headliners-only ranking", () => {
    expect(
      noFanData({
        baselines,
        venueRuns: [
          run(HALL, "mid", "a", "b", "c", "d"),
          run(ROOM, "mid", "b", "a", "c", "d"),
          run(HALL, "opener", "w", "x", "y"),
        ],
      }),
    ).toEqual([HALL.entityId]);
  });

  it("doesn't when one of its runs differs, even only in order", () => {
    expect(
      noFanData({
        baselines,
        venueRuns: [
          run(HALL, "mid", "a", "b", "c", "d"),
          run(HALL, "opener", "x", "w", "y"),
        ],
      }),
    ).toEqual([]);
  });

  it("doesn't when a run holds more or fewer acts than the ranking", () => {
    for (const list of [
      ["a", "b", "c"],
      ["a", "b", "c", "d", "e"],
    ])
      expect(
        noFanData({ baselines, venueRuns: [run(HALL, "mid", ...list)] }),
        list.join(),
      ).toEqual([]);
  });

  it("doesn't when the band has no headliners-only ranking, or both are empty", () => {
    expect(
      noFanData({
        baselines: { opener: baselines.opener },
        venueRuns: [run(HALL, "mid", "a", "b", "c", "d")],
      }),
    ).toEqual([]);
    expect(
      noFanData({ baselines: { mid: [] }, venueRuns: [run(HALL, "mid")] }),
    ).toEqual([]);
  });

  it("lists each venue once, in the order the build read them", () => {
    expect(
      noFanData({
        baselines,
        venueRuns: [
          run(ROOM, "opener", "w", "x", "y"),
          run(HALL, "mid", "a", "b", "c", "d"),
          run(ROOM, "mid", "a", "b", "c", "d"),
        ],
      }),
    ).toEqual([ROOM.entityId, HALL.entityId]);
  });
});
