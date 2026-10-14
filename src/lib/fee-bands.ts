export type FeeBandId = "mid" | "opener";

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
