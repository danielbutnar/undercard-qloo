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

/**
 * A festival brand filed as a place (M6o; docs/evidence.md section 14): "festival" is among
 * the three words Qloo's keywords for it use most. Venue 156 in Cluj-Napoca is one;
 * none of the other rooms in the saved builds is.
 */
const FESTIVAL_KEYWORD_RANK = 3;

/**
 * "a festival", "an arena", "a stadium", "an outdoor festival site" or "a sports ground";
 * null for a club. Keywords are Qloo's for the place, most frequent first.
 */
export function roomKind(
  tags: readonly { id: string }[],
  keywords: readonly string[] = [],
): string | null {
  if (keywords.slice(0, FESTIVAL_KEYWORD_RANK).includes("festival"))
    return "a festival";
  const categories = new Set(
    tags
      .filter((tag) => tag.id.startsWith(CATEGORY))
      .map((tag) => tag.id.slice(CATEGORY.length)),
  );
  for (const [label, kinds] of KINDS)
    if (kinds.some((kind) => categories.has(kind))) return label;
  return null;
}
