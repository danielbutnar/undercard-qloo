// Plan.md item 8: the review's three measures over the With and Without Qloo lineups (evidence
// section 31), on invented lineups.
import { describe, expect, it } from "vitest";
import { lineupMeasures } from "@/lib/with-without";

describe("the With and Without Qloo measures (plan.md item 8)", () => {
  const towns = [
    { with: ["a", "b", "c", "d"], without: ["a", "x", "y", "z"] },
    { with: ["e", "f", "g", "h"], without: ["x", "y", "e", "w"] },
    { with: ["a", "i", "j", "k"], without: ["x", "y", "v", "u"] },
  ];

  it("counts, per town, the Qloo acts the model's picks don't have", () => {
    expect(lineupMeasures(towns).changed).toEqual([3, 3, 4]);
  });

  // Corrected 2026-10-22: the average rounded to 10 hid Duluth's one shared act, so the count is
  // exact: the Qloo acts each town's model picks also have, and the towns with any.
  it("counts the acts the two lineups share, and the towns where they share any", () => {
    const m = lineupMeasures(towns);
    expect(m.sharedActs).toBe(2);
    expect(m.townsSharingAnAct).toBe(2);
    expect(
      lineupMeasures([{ with: ["a", "b"], without: ["c", "d"] }]),
    ).toMatchObject({ sharedActs: 0, townsSharingAnAct: 0 });
  });

  it("counts the distinct acts on each side, and the model's acts in half the towns or more", () => {
    const m = lineupMeasures(towns);
    expect(m.distinctWith).toBe(11);
    expect(m.distinctWithout).toBe(8);
    // x and y are in all three Without lineups; half of 3 is 1.5, so 2 or more.
    expect(m.inHalfOrMoreWithout).toBe(2);
    expect(m.averageChanged).toBeCloseTo(10 / 3, 5);
  });

  it("checks the bar: at least 7 of 10 changed in at least 24 of 29 towns, and twice the distinct acts", () => {
    const twentyNine = (changed: number, distinctTimes: number) =>
      Array.from({ length: 29 }, (_, town) => ({
        with: Array.from({ length: 10 }, (_, i) => `w${town}-${i}`),
        without: [
          ...Array.from({ length: 10 - changed }, (_, i) => `w${town}-${i}`),
          ...Array.from({ length: changed }, (_, i) =>
            distinctTimes >= 2 ? `shared-${i}` : `m${town}-${i}`,
          ),
        ],
      }));
    expect(lineupMeasures(twentyNine(8, 2)).barMet).toBe(true);
    expect(lineupMeasures(twentyNine(6, 2)).barMet).toBe(false);
    expect(lineupMeasures(twentyNine(8, 1)).barMet).toBe(false);
  });
});
