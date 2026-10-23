/**
 * Evidence section 34 (docs/evidence.md): the premise test's two controls. Control A reads
 * another town's venues; Control B, Qloo's location signal. Pure arithmetic and the choice of
 * the control town; the calls are in scripts/premise-controls.ts.
 */

export type TownRef = { city: string; country: string };

/**
 * Control A's town: the next of the checked towns in alphabetical order, wrapping round, that is
 * in another country and has at least as many anchor venues as the festival's own town needs.
 */
export function controlTownFor<T extends TownRef>(
  towns: readonly T[],
  anchorCount: (city: string) => number,
  city: string,
  needed: number,
): T | null {
  const sorted = [...towns].sort((a, b) => a.city.localeCompare(b.city, "en"));
  const at = sorted.findIndex((town) => town.city === city);
  if (at < 0) return null;
  const own = sorted[at];
  for (let step = 1; step < sorted.length; step++) {
    const town = sorted[(at + step) % sorted.length];
    if (town.country !== own.country && anchorCount(town.city) >= needed)
      return town;
  }
  return null;
}

/** Section 26's mean: the lifts there are, null when there are none. */
export function meanOf(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length
    ? present.reduce((sum, value) => sum + value, 0) / present.length
    : null;
}

/**
 * Bars A and B, counted over the festivals: each row holds a festival's advantage (booked mean
 * lift minus random mean lift) with its own town's venues, another town's, and the location
 * signal; null where a control couldn't score it. A tie counts for neither side.
 */
export function tallyBars(
  rows: readonly {
    own: number | null;
    other: number | null;
    signal: number | null;
  }[],
) {
  const tally = {
    ownBeatsOther: 0,
    venuesBeatSignal: 0,
    signalBeatsVenues: 0,
    scoredA: 0,
    scoredB: 0,
  };
  for (const { own, other, signal } of rows) {
    if (own === null) continue;
    if (other !== null) {
      tally.scoredA++;
      if (own > other) tally.ownBeatsOther++;
    }
    if (signal !== null) {
      tally.scoredB++;
      if (own > signal) tally.venuesBeatSignal++;
      if (signal > own) tally.signalBeatsVenues++;
    }
  }
  return tally;
}
