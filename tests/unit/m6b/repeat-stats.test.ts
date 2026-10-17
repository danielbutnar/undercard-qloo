import { describe, expect, it } from "vitest";
import { repeatStats } from "@/lib/robustness";

describe("repeatStats", () => {
  it("counts the acts in every run, the distinct acts, and the overlap between each pair of runs", () => {
    const stats = repeatStats([
      ["a", "b", "c", "d"],
      ["a", "b", "c", "e"],
      ["a", "b", "f", "g"],
    ]);
    expect(stats.runs).toBe(3);
    expect(stats.inEveryRun).toBe(2);
    expect(stats.distinct).toBe(7);
    // Pairs: (1,2) share 3, (1,3) share 2, (2,3) share 2.
    expect(stats.pairOverlap).toEqual({ min: 2, max: 3, each: [3, 2, 2] });
  });

  it("handles a single run", () => {
    expect(repeatStats([["a", "b"]])).toEqual({
      runs: 1,
      inEveryRun: 2,
      distinct: 2,
      pairOverlap: { min: null, max: null, each: [] },
    });
  });
});
