import { feeBandFor, type FeeBand, type FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { PickCheck } from "@/lib/llm-only";
import { formatBandRange, formatCount } from "@/lib/format";
import { roomShortName } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

/** What the chart says, in one place. Plain words first (M6q, M6r); pictures carry the rest. */

export const QLOO_CLAUSE =
  "Qloo, a taste-data service that maps what fans of one artist, venue or film also like";

/** Qloo explained once, under the first click. */
export const QLOO_LINE =
  "Qloo is a taste-data service: it maps what fans of one artist, venue or film also like.";

/**
 * Under the headliners: who they are (M6q: the demo's are bands; a judge's own may not be) and
 * that everyone below is Undercard's draft from Qloo's numbers (the AI agent plans the calls).
 */
export function headlinersNote(festival: Festival, drafted = true): string {
  return `${headlinersBooked(festival)} · Undercard ${drafted ? "drafted" : "will draft"} the rest of the lineup (the bill) from Qloo's numbers`;
}

/** Only who the headliners are: Without Qloo, nothing below them is the AI agent's. */
export function headlinersBooked(festival: Festival): string {
  const bands =
    festival.headliners[0] === SAGEBRUSH_SOUND.headliners[0] &&
    festival.headliners[1] === SAGEBRUSH_SOUND.headliners[1];
  return `${bands ? "The headliners, two bands, are" : "The headliners are"} already booked`;
}

/** The headline: what this screen is, in the two seconds a glance gives it. */
export const headline = (festival: Festival) =>
  `A festival lineup, drafted from ${festival.city}'s own music venues.`;

/** What Undercard does, with Qloo explained once. */
export const WHAT_IT_DOES = `Undercard is an AI agent. It picks the acts that play before the headliners from what fans of the town's own venues like, read from ${QLOO_CLAUSE}.`;

/**
 * The example (M6q), in words a non-musician follows. The demo's headliners are bands; a judge's
 * own may not be, so theirs are only named.
 */
export function exampleLine(festival: Festival): string {
  const [first, second] = festival.headliners;
  const where = festival.region
    ? `${festival.city}, ${festival.region}`
    : festival.city;
  const bands =
    first === SAGEBRUSH_SOUND.headliners[0] &&
    second === SAGEBRUSH_SOUND.headliners[1];
  return `Example: a ${formatCount(festival.capacity)}-person festival in ${where}. Its headliners, ${first} and ${second}, ${bands ? "are bands" : "are already booked"}.`;
}

export const factsLine = ({ city, region, capacity, crowdAge }: Festival) =>
  `${region ? `${city}, ${region}` : city} · ${formatCount(capacity)} capacity · crowd aged ${crowdAge.min}–${crowdAge.max}`;

export const PLAIN_BAND: Record<FeeBandId, string> = {
  mid: "Mid-size acts",
  opener: "Opening acts",
};

export const STAMP = "Draft, not announced";
export const WATCH = "Watch how it picked these acts";
export const SKIP = "Skip to the lineup";
export const RUN_LIVE = "Run the agent live instead";

/** The fee range in plain words (M6r): the plain term first, the buyer's once in brackets. */
export const feeRangeWords = (band: FeeBand) =>
  `${band.slots} slots · fee range (${band.label}): with no real fees to go on, how popular an act is on Qloo stands in for what it charges (${formatBandRange(band)} percentile)`;

export function ordinal(place: number): string {
  const teen = Math.floor((place % 100) / 10) === 1;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][place % 10] ?? "th");
  return `${place}${suffix}`;
}

/** A venue's short mark on a row: its bracketed abbreviation or initials, else its name. */
export const venueShort = (name: string) => roomShortName(name);

export const liftedWords = (lifted: number) =>
  lifted === 0
    ? "lifted none"
    : `${lifted} ${lifted === 1 ? "act" : "acts"} lifted`;

export const venuesTitle = (city: string) =>
  `${city} venues whose fans shaped this lineup`;

export const VENUES_STAND_FOR =
  "These venues stand for the town's taste: the acts won't necessarily play there.";

const RANGE_NAME: Record<FeeBandId, string> = {
  mid: "mid-size",
  opener: "opening",
};

/**
 * A Without Qloo card's line (prompt-4): where Qloo puts the model's pick, size first, from the
 * cache-only checks (src/server/pick-checks.ts). The percentile rounds down, as an act card's
 * does; a pick just over the top edge reads one past it, never as the edge itself.
 */
export function pickCheckLine(
  check: PickCheck | undefined,
  festival: Festival,
): string {
  const picked = "Picked without Qloo";
  if (!check || check.status === "not-checked")
    return `${picked}; not checked on Qloo`;
  if (check.status === "not-found") return `${picked}; not found on Qloo`;
  const bands = [...festival.feeBands].sort(
    (a, b) => a.minPopularity - b.minPopularity,
  );
  const band =
    check.range === "above"
      ? bands[bands.length - 1]
      : check.range === "below"
        ? bands[0]
        : (feeBandFor(check.popularity, bands) ?? bands[0]);
  const down = (popularity: number) => Math.floor(popularity * 100 + 1e-9);
  const percent =
    check.range === "above"
      ? Math.max(down(check.popularity), down(band.maxPopularity) + 1)
      : down(check.popularity);
  const genres =
    check.genres === 0
      ? "no genres shared"
      : `${check.genres} ${check.genres === 1 ? "genre" : "genres"} shared`;
  const climb =
    check.climb !== null && check.climb > 0
      ? `a climb with one of ${festival.city}'s venues`
      : `no climb with ${festival.city}'s venues`;
  return `${picked}; on Qloo: popularity ${ordinal(percent)}, ${check.range} the ${RANGE_NAME[band.id]} range · ${genres} · ${climb}`;
}
