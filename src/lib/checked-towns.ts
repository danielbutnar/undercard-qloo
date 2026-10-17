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

const US_STATES =
  "alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada new-hampshire new-jersey new-mexico new-york north-carolina north-dakota ohio oklahoma oregon pennsylvania rhode-island south-carolina south-dakota tennessee texas utah vermont virginia washington west-virginia wisconsin wyoming district-of-columbia usa us u.s. u.s.a. america united-states-of-america";
const CA_PROVINCES =
  "alberta british-columbia manitoba new-brunswick newfoundland newfoundland-and-labrador nova-scotia ontario prince-edward-island quebec québec saskatchewan yukon nunavut northwest-territories";
const UK_NATIONS = "england scotland wales northern-ireland uk u.k. great-britain britain";

/** The country a typed state or country names, from the region names alone; null when unknown. */
const COUNTRY_OF = new Map<string, string>([
  ...US_STATES.split(" ").map((name) => [name, "United States"] as const),
  ...CA_PROVINCES.split(" ").map((name) => [name, "Canada"] as const),
  ...UK_NATIONS.split(" ").map((name) => [name, "United Kingdom"] as const),
]);

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");

/**
 * The checked towns to offer after a typed town is thin (M6n): those in its country, or all of
 * them when the country has none or can't be told from the region.
 */
export function townsNear(region: string): {
  country: string | null;
  towns: readonly CheckedTown[];
} {
  const typed = key(region);
  const country =
    COUNTRY_OF.get(typed) ??
    CHECKED_TOWNS.find(
      (town) => key(town.region) === typed || key(town.country) === typed,
    )?.country ??
    null;
  const towns = CHECKED_TOWNS.filter((town) => town.country === country);
  return towns.length > 0
    ? { country, towns }
    : { country: null, towns: CHECKED_TOWNS };
}
