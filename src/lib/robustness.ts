/** How much the bill repeats across runs of the same brief (M6b). Acts are compared by id. */
export interface RepeatStats {
  runs: number;
  /** Acts on every run's bill. */
  inEveryRun: number;
  /** Different acts across all runs. */
  distinct: number;
  /** Acts two runs share, for each pair of runs in order (1-2, 1-3, …, 2-3, …). */
  pairOverlap: { min: number | null; max: number | null; each: number[] };
}

export function repeatStats(runs: readonly (readonly string[])[]): RepeatStats {
  const sets = runs.map((acts) => new Set(acts));
  const all = new Set(sets.flatMap((set) => [...set]));
  const inEveryRun = [...all].filter((act) =>
    sets.every((set) => set.has(act)),
  ).length;
  const each: number[] = [];
  for (let i = 0; i < sets.length; i++)
    for (let j = i + 1; j < sets.length; j++)
      each.push([...sets[i]].filter((act) => sets[j].has(act)).length);
  return {
    runs: runs.length,
    inEveryRun,
    distinct: all.size,
    pairOverlap: {
      min: each.length ? Math.min(...each) : null,
      max: each.length ? Math.max(...each) : null,
      each,
    },
  };
}
