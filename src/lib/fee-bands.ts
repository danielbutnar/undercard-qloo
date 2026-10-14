export const FEE_BAND_IDS = ["mid", "opener"] as const;
export type FeeBandId = (typeof FEE_BAND_IDS)[number];

/**
 * A fee band the buyer sets, expressed as a range of Qloo popularity percentiles (0 to 1).
 * Both edges are inclusive; where two bands share an edge, the higher band wins it.
 */
export interface FeeBand {
  id: FeeBandId;
  label: string;
  minPopularity: number;
  maxPopularity: number;
  slots: number;
}

/** The band a popularity percentile falls in, or null when it sits above or below every band. */
export function feeBandFor<Band extends FeeBand>(
  popularity: number,
  bands: readonly Band[],
): Band | null {
  if (!Number.isFinite(popularity) || popularity < 0 || popularity > 1)
    return null;
  const highestFirst = [...bands].sort(
    (a, b) => b.minPopularity - a.minPopularity,
  );
  return (
    highestFirst.find(
      (band) =>
        popularity >= band.minPopularity && popularity <= band.maxPopularity,
    ) ?? null
  );
}
