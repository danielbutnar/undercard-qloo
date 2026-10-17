/**
 * Where a place is, from Qloo's own geocode on the place (M6j; docs/evidence.md section 11).
 * Reading it costs no call, so a town can be checked against its state or country for free.
 */
export interface PlaceWhere {
  /** The town or city Qloo puts the place in, such as "Burlington" or "Winooski". */
  city?: string;
  /** The neighbourhood or town Qloo names, such as "Old North End" or "Richmond". */
  name?: string;
  /** The county or the larger town, such as "Chittenden County" or "Brighton and Hove". */
  admin2?: string;
  /** The state, province or nation, such as "Vermont", "Ontario" or "England". */
  admin1?: string;
  country?: string;
  countryCode?: string;
}

/** Fewer places than this in the intended region, and the plain name may be the wrong town. */
export const MIN_PLACES_IN_REGION = 5;

const fold = (text: string) =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** True when Qloo puts the place in the region (a state, province, nation or country). */
export function inRegion(
  where: PlaceWhere | undefined,
  region: string,
): boolean {
  if (!where || !region.trim()) return false;
  const wanted = fold(region);
  return [where.admin1, where.country, where.countryCode]
    .filter((value): value is string => Boolean(value))
    .some((value) => fold(value) === wanted);
}

/** True when the place's geocode names the town itself (its own name or its county). */
export function inTown(where: PlaceWhere | undefined, city: string): boolean {
  if (!where) return false;
  const town = fold(city);
  // Qloo's own city decides when it gives one: South End is Burlington, Winooski isn't.
  if (where.city) return fold(where.city) === town;
  return [where.name, where.admin2]
    .filter((value): value is string => Boolean(value))
    .some((value) => fold(value).includes(town));
}

/**
 * Whether the plain name's places should be checked with "town, region" too: fewer than five
 * in the region, or any outside it. Places without a geocode can't be checked; when none has
 * one, the plain name stands (older cached answers carry no geocode).
 */
export function needsFullName(
  places: readonly { where?: PlaceWhere }[],
  region: string,
): boolean {
  if (!region.trim()) return false;
  if (places.length > 0 && places.every((place) => !place.where)) return false;
  const known = places.filter((place) => place.where);
  const inside = known.filter((place) => inRegion(place.where, region)).length;
  return inside < MIN_PLACES_IN_REGION || inside < known.length;
}

/** The answer with more places in the region, and its places outside the region left out. */
export function placesInRegion<P extends { where?: PlaceWhere }>(
  answers: readonly (readonly P[])[],
  region: string,
): { places: P[]; outside: number; answer: number } {
  const scored = answers.map((places, answer) => {
    const kept = places.filter(
      (place) => !place.where || inRegion(place.where, region),
    );
    return { places: kept, outside: places.length - kept.length, answer };
  });
  return scored.reduce((best, next) =>
    next.places.length > best.places.length ? next : best,
  );
}

/** The place a town resolved to, as Qloo's geocodes say most often: "Burlington, Vermont, US". */
export function resolvedName(
  city: string,
  places: readonly { where?: PlaceWhere }[],
): string | null {
  const counts = new Map<string, number>();
  for (const { where } of places) {
    if (!where?.admin1 && !where?.countryCode) continue;
    const key = [where.admin1, where.countryCode].filter(Boolean).join(", ");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  return top ? `${city}, ${top[0]}` : null;
}
