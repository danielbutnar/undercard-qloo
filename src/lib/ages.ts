/**
 * Qloo's age buckets for signal.demographics.age (Parameter Reference, docs.qloo.com, read
 * 2026-10-17): 24_and_younger | 25_to_29 | 30_to_34 | 35_to_44 | 45_to_54 | 55_and_older.
 */
const BUCKETS = [
  { id: "24_and_younger", min: 0, max: 24 },
  { id: "25_to_29", min: 25, max: 29 },
  { id: "30_to_34", min: 30, max: 34 },
  { id: "35_to_44", min: 35, max: 44 },
  { id: "45_to_54", min: 45, max: 54 },
  { id: "55_and_older", min: 55, max: Infinity },
] as const;

/**
 * The Qloo buckets that cover a crowd's age range. Exact when the buckets span the range and
 * nothing more; otherwise they are the nearest buckets that contain it.
 */
export function ageBuckets(
  min: number,
  max: number,
): { buckets: string[]; exact: boolean } {
  const covering = BUCKETS.filter(
    (bucket) => bucket.max >= min && bucket.min <= max,
  );
  return {
    buckets: covering.map((bucket) => bucket.id),
    exact:
      covering.length > 0 &&
      covering[0].min === min &&
      covering[covering.length - 1].max === max,
  };
}
