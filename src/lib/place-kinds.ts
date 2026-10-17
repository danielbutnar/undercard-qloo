/**
 * What kind of place a room is, when it isn't a club (M6l). This is M6i's rule, which failed as
 * a filter (docs/evidence.md section 10), kept as a label only: a festival park or an arena can
 * still anchor a bill, and its card and trace line now say what it is. Booking doesn't read it.
 * Museums aren't named: Nashville's Venue 281 is filed as a museum and a concert hall.
 */
const KINDS: [label: string, categories: string[]][] = [
  [
    "a stadium",
    ["stadium", "baseball_field", "football_field", "soccer_field"],
  ],
  ["an arena", ["arena", "ice_hockey_rink", "hockey_rink"]],
  [
    "an outdoor festival site",
    ["park", "playground", "fairground", "amusement_park", "theme_park", "zoo"],
  ],
  [
    "a sports ground",
    ["sports_complex", "car_racing_venue", "car_racing_track", "golf_course"],
  ],
];

const CATEGORY = "urn:tag:category:place:";

/** "an arena", "a stadium", "an outdoor festival site" or "a sports ground"; null for a club. */
export function roomKind(tags: readonly { id: string }[]): string | null {
  const categories = new Set(
    tags
      .filter((tag) => tag.id.startsWith(CATEGORY))
      .map((tag) => tag.id.slice(CATEGORY.length)),
  );
  for (const [label, kinds] of KINDS)
    if (kinds.some((kind) => categories.has(kind))) return label;
  return null;
}
