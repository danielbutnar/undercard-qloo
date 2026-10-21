/** One town's two lineups, each act as a key (Qloo's entity id, or a normalised name). */
export interface TownLineups {
  with: readonly string[];
  without: readonly string[];
}

/**
 * The review's measures over the With and Without Qloo lineups (docs/evidence.md section 31,
 * plan.md item 8): per town, the Qloo acts the model's picks don't have; the distinct acts on
 * each side; the model's acts named in half the towns or more; and the bar, at least 7 of 10
 * changed in at least 24 of 29 towns with at least twice as many distinct acts with Qloo.
 */
export function lineupMeasures(towns: readonly TownLineups[]) {
  const changed = towns.map(
    (town) => town.with.filter((act) => !town.without.includes(act)).length,
  );
  const distinct = (side: "with" | "without") =>
    new Set(towns.flatMap((town) => [...new Set(town[side])])).size;
  const timesNamed = new Map<string, number>();
  for (const town of towns)
    for (const act of new Set(town.without))
      timesNamed.set(act, (timesNamed.get(act) ?? 0) + 1);
  const distinctWith = distinct("with");
  const distinctWithout = distinct("without");
  const townsChangedSeven = changed.filter((count) => count >= 7).length;
  return {
    changed,
    averageChanged:
      changed.reduce((sum, count) => sum + count, 0) / (changed.length || 1),
    townsChangedSeven,
    distinctWith,
    distinctWithout,
    inHalfOrMoreWithout: [...timesNamed.values()].filter(
      (times) => times >= towns.length / 2,
    ).length,
    barMet: townsChangedSeven >= 24 && distinctWith >= 2 * distinctWithout,
  };
}
