import { CHECKED_TOWNS, townsNear, type CheckedTown } from "./checked-towns";
import { controlTownFor as nextAbroad } from "./premise-controls";

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The town a build's controls come from (WS13.3, section 37's reading 1): for a checked town,
 * the next of the checked towns in alphabetical order that is in another country, wrapping
 * round, with no anchor clause; for a judge's own town, the first checked town in another
 * country, its country told from the region it was typed with (none: the first checked town).
 */
export function controlTownFor(town: {
  city: string;
  region: string;
}): CheckedTown | null {
  const checked = CHECKED_TOWNS.find(
    (entry) => same(entry.city, town.city) && same(entry.region, town.region),
  );
  if (checked) return nextAbroad(CHECKED_TOWNS, () => 0, checked.city, 0);
  const { country } = townsNear(town.region);
  return (
    [...CHECKED_TOWNS]
      .sort((a, b) => a.city.localeCompare(b.city, "en"))
      .find((entry) => entry.country !== country) ?? null
  );
}
