/**
 * Towns where Undercard has already filled both bands with the demo's brief (M6k), from
 * docs/evidence.md: the four demo towns (sections 3, 5 and M6d), the pilot towns (section 4),
 * the second outreach wave (section 9) and the towns re-measured once resolved (section 12). Names, states or provinces, and countries only;
 * no Qloo data. Region is what resolves the town (M6j): a state or province where the country
 * has them in Qloo's geocode, else the country.
 */
export interface CheckedTown {
  city: string;
  region: string;
  country: string;
}

export const CHECKED_TOWNS: readonly CheckedTown[] = [
  { city: "Boise", region: "Idaho", country: "United States" },
  { city: "Austin", region: "Texas", country: "United States" },
  { city: "Denver", region: "Colorado", country: "United States" },
  { city: "Nashville", region: "Tennessee", country: "United States" },
  { city: "Raleigh", region: "North Carolina", country: "United States" },
  { city: "Chicago", region: "Illinois", country: "United States" },
  { city: "Seattle", region: "Washington", country: "United States" },
  { city: "Minneapolis", region: "Minnesota", country: "United States" },
  { city: "Duluth", region: "Minnesota", country: "United States" },
  { city: "Kansas City", region: "Missouri", country: "United States" },
  { city: "Asheville", region: "North Carolina", country: "United States" },
  { city: "Bozeman", region: "Montana", country: "United States" },
  { city: "Burlington", region: "Vermont", country: "United States" },
  { city: "Calgary", region: "Alberta", country: "Canada" },
  { city: "Toronto", region: "Ontario", country: "Canada" },
  { city: "Montreal", region: "Quebec", country: "Canada" },
  { city: "Reykjavík", region: "Iceland", country: "Iceland" },
  { city: "Oslo", region: "Norway", country: "Norway" },
  { city: "Aarhus", region: "Denmark", country: "Denmark" },
  { city: "Tallinn", region: "Estonia", country: "Estonia" },
  { city: "Berlin", region: "Germany", country: "Germany" },
  { city: "Hamburg", region: "Germany", country: "Germany" },
  { city: "Utrecht", region: "Netherlands", country: "Netherlands" },
  { city: "Rotterdam", region: "Netherlands", country: "Netherlands" },
  { city: "Paris", region: "France", country: "France" },
  { city: "Vienna", region: "Austria", country: "Austria" },
  { city: "Bucharest", region: "Romania", country: "Romania" },
  { city: "Cluj-Napoca", region: "Romania", country: "Romania" },
  { city: "Wrexham", region: "Wales", country: "United Kingdom" },
];

/** "Austin, Texas, United States" or "Tallinn, Estonia". */
export function checkedTownLabel(town: CheckedTown): string {
  return town.region === town.country
    ? `${town.city}, ${town.country}`
    : `${town.city}, ${town.region}, ${town.country}`;
}
