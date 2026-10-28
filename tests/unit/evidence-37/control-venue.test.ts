import { describe, expect, it } from "vitest";
import {
  climb,
  controlCandidates,
  localLift,
  matchControl,
  noFanData,
  OUTSIDE_PLACE,
  placeIn,
} from "@/lib/control-venue";

// Invented rooms and acts: names and ids only, no Qloo data.
const room = (entityId: string, name: string, popularity?: number | null) => ({
  entityId,
  name,
  popularity,
});
const ids = (rooms: readonly { entityId: string }[]) =>
  rooms.map((entry) => entry.entityId);

describe("controlCandidates", () => {
  it("puts the room whose popularity is closest to the venue's first", () => {
    const rooms = [
      room("r1", "Annex", 0.5),
      room("r2", "Boathouse", 0.9),
      room("r3", "Cellar", 0.7),
    ];
    expect(ids(controlCandidates(rooms, 0.72))).toEqual(["r3", "r2", "r1"]);
  });

  it("breaks a tie in closeness by name, above and below alike", () => {
    // 0.6 and 0.8 sit equally far from 0.7, though floating point says otherwise.
    const rooms = [
      room("r1", "Velvet", 0.6),
      room("r2", "Arcade", 0.8),
      room("r3", "Mill", 0.7),
    ];
    expect(ids(controlCandidates(rooms, 0.7))).toEqual(["r3", "r2", "r1"]);
  });

  it("breaks a tie in name by entity id, so the order never depends on the answer's order", () => {
    const rooms = [room("r9", "Depot", 0.4), room("r2", "Depot", 0.4)];
    expect(ids(controlCandidates(rooms, 0.5))).toEqual(["r2", "r9"]);
    expect(ids(controlCandidates([...rooms].reverse(), 0.5))).toEqual([
      "r2",
      "r9",
    ]);
  });

  it("leaves out a room Qloo gave no popularity for", () => {
    const rooms = [
      room("r1", "Annex"),
      room("r2", "Boathouse", null),
      room("r3", "Cellar", Number.NaN),
      room("r4", "Dock", 0.3),
    ];
    expect(ids(controlCandidates(rooms, 0.9))).toEqual(["r4"]);
  });

  it("with no popularity for the venue, keeps Qloo's own order, every room in it", () => {
    const rooms = [
      room("r3", "Cellar", 0.2),
      room("r1", "Annex"),
      room("r2", "Boathouse", 0.9),
    ];
    expect(ids(controlCandidates(rooms, null))).toEqual(["r3", "r1", "r2"]);
  });

  it("doesn't change the rooms it is given", () => {
    const rooms = [room("r1", "Annex", 0.1), room("r2", "Boathouse", 0.9)];
    controlCandidates(rooms, 0.95);
    expect(ids(rooms)).toEqual(["r1", "r2"]);
  });
});

describe("matchControl", () => {
  it("skips a room Qloo reported unscored for the next closest, and asks no further", async () => {
    const asked: string[] = [];
    const candidates = [
      room("r1", "Annex", 0.7),
      room("r2", "Boathouse", 0.65),
      room("r3", "Cellar", 0.2),
    ];
    const match = await matchControl(candidates, async (candidate) => {
      asked.push(candidate.entityId);
      return candidate.entityId !== "r1";
    });
    expect(match.control?.entityId).toBe("r2");
    expect(ids(match.skipped)).toEqual(["r1"]);
    expect(asked).toEqual(["r1", "r2"]);
  });

  it("finds no control when no room is scored", async () => {
    const candidates = [room("r1", "Annex", 0.7), room("r2", "Boathouse", 0.6)];
    const match = await matchControl(candidates, async () => false);
    expect(match.control).toBeNull();
    expect(ids(match.skipped)).toEqual(["r1", "r2"]);
  });

  it("finds no control among no rooms", async () => {
    expect(await matchControl([], async () => true)).toEqual({
      control: null,
      skipped: [],
    });
  });
});

describe("placeIn", () => {
  const ranking = Array.from({ length: 60 }, (_, index) => `a${index + 1}`);

  it("counts places from 1", () => {
    expect(placeIn(ranking, "a1")).toBe(1);
    expect(placeIn(ranking, "a50")).toBe(50);
  });

  it("counts an act outside the top 50, or missing, as 51st", () => {
    expect(OUTSIDE_PLACE).toBe(51);
    expect(placeIn(ranking, "a51")).toBe(51);
    expect(placeIn(ranking, "a60")).toBe(51);
    expect(placeIn(ranking, "nobody")).toBe(51);
    expect(placeIn([], "a1")).toBe(51);
  });

  it("reads a ranking of entities as well as one of ids", () => {
    expect(placeIn([{ entityId: "x" }, { entityId: "y" }], "y")).toBe(2);
  });
});

describe("climb and localLift", () => {
  const headlinersOnly = ["a", "b", "c", "d", "e", "f", "g"];
  const withVenue = ["f", "a", "b"];
  const withControl = ["a", "b", "c", "d", "f"];

  it("climb: the act's place without the input minus its place with it", () => {
    expect(climb("f", headlinersOnly, withVenue)).toBe(5);
    expect(climb("a", headlinersOnly, withVenue)).toBe(-1);
    // Not in the headliners-only top 50: it climbs from 51st.
    expect(climb("f", [], withVenue)).toBe(50);
  });

  it("local lift: the act's place with the control's fans minus its place with the venue's", () => {
    expect(localLift("f", withVenue, withControl)).toBe(4);
    expect(localLift("b", withVenue, withControl)).toBe(-1);
    // Outside the control's top 50: 51st.
    expect(localLift("f", withVenue, ["a"])).toBe(50);
    // Outside both: no lift either way.
    expect(localLift("z", withVenue, withControl)).toBe(0);
  });

  it("local lift: none without a scored control", () => {
    expect(localLift("f", withVenue, null)).toBeNull();
  });
});

describe("noFanData", () => {
  const without = ["a", "b", "c"];

  it("is a warning when Qloo says it didn't score the input", () => {
    expect(noFanData({ warned: true, ranking: ["c", "a"], without })).toBe(
      "warning",
    );
  });

  it("with no warning, is an equal ranking when adding the input changed nothing, entity for entity and in order", () => {
    expect(
      noFanData({ warned: false, ranking: ["a", "b", "c"], without }),
    ).toBe("equal ranking");
    expect(
      noFanData({
        warned: false,
        ranking: [{ entityId: "a" }, { entityId: "b" }, { entityId: "c" }],
        without,
      }),
    ).toBe("equal ranking");
  });

  it("is none when the ranking moved, or when there is nothing to compare", () => {
    expect(
      noFanData({ warned: false, ranking: ["b", "a", "c"], without }),
    ).toBeNull();
    expect(
      noFanData({ warned: false, ranking: ["a", "b"], without }),
    ).toBeNull();
    // As src/lib/fan-data.ts: an empty ranking never counts.
    expect(noFanData({ warned: false, ranking: [], without: [] })).toBeNull();
  });
});
