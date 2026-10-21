import type { FeeBand, FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import { formatBandRange, formatCount } from "@/lib/format";
import type { Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

/**
 * What the product says, word for word as the live first screen says it (src/components/
 * festival-screen.tsx and draft-bill.tsx at c5927c7). Not up for redesign in this round: every
 * direction sets these words in its own way and changes none of them.
 */
export const FIRST_LINE_REST =
  "is an AI agent that helps a music festival choose the smaller acts that play before the stars, using what fans of the town's own music venues already like, read from Qloo, a taste-data service that maps what fans of one artist, venue or film also like.";

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

export const PLAIN_BAND: Record<FeeBandId, string> = {
  mid: "Mid-size acts",
  opener: "Opening acts",
};

export const BILL_LINE =
  "This is the draft lineup (the bill): the headliners are booked, and the AI agent picked the acts below.";
export const CLICK_LINE =
  "Click an act to see why, keep it or mark it unavailable.";
export const STAMP = "Draft, not announced";

export const WATCH = "Watch how it picked these acts";
export const WATCH_NOTE =
  "Replays the saved build's Qloo calls; they list under the lineup.";
export const SKIP = "Skip to the lineup";

/** The fee range's words (M6r): the plain term, then the buyer's, once, in brackets. */
export function feeRangeLine(band: FeeBand): string {
  return `${band.slots} slots · fee range (${band.label}): with no real fees to go on, how popular an act is on Qloo stands in for what it charges (${formatBandRange(band)} percentile)`;
}

/** The same words split: the range on the band's line, the reason once for both bands. */
export const feeRangeShort = (band: FeeBand) =>
  `${band.slots} slots · fee range (${band.label}): ${formatBandRange(band)} percentile`;
export const FEE_RANGE_WHY =
  "Fee range: with no real fees to go on, how popular an act is on Qloo stands in for what it charges.";

export const factsLine = ({ city, region, capacity, crowdAge }: Festival) =>
  `${region ? `${city}, ${region}` : city} · ${formatCount(capacity)} capacity · crowd aged ${crowdAge.min}–${crowdAge.max}`;

/** The venue-and-climb reason every act carries (M6q, M6r). */
export const venueLine = (act: Act) => `${act.anchorVenue.name} fans like it`;

/** "+11" with "places higher in Qloo's ranking", or "new" with "to Qloo's top 50": never a bare +N. */
export function climbWords(
  act: Act,
  top?: number,
): { badge: string; words: string } | null {
  const lift = liftOf(act);
  if (!lift) return null;
  return lift.kind === "up"
    ? { badge: `+${lift.places}`, words: "places higher in Qloo's ranking" }
    : { badge: "new", words: `to Qloo's top ${top ?? lift.top}` };
}

/** M6l: a park, arena or festival site is named as such. */
export const venueKind = (act: Act) =>
  act.anchorVenue.kind
    ? `${act.anchorVenue.name} is ${act.anchorVenue.kind}, not a club.`
    : null;

const savedAt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export function draftedLine(
  calls: number | undefined,
  createdAt: string | undefined,
) {
  return calls && createdAt
    ? `Drafted by the AI agent from ${calls} Qloo calls · saved ${savedAt.format(new Date(createdAt))} UTC`
    : "No undercard drafted yet.";
}

/** A climb step's caption, as the live climb words it. */
export const stepLine = (venue: { name: string } | null) =>
  venue
    ? `Re-ranked with the fans of ${venue.name} added`
    : "Ranked for the headliners' fans alone";

/** Where an act stood before a venue's fans were added: "was 14th". */
export function ordinal(place: number): string {
  const teen = Math.floor((place % 100) / 10) === 1;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][place % 10] ?? "th");
  return `${place}${suffix}`;
}

/** The venues rail's words (src/components/rooms-rail.tsx). */
export const venuesTitle = (city: string) =>
  `${city} venues whose fans shaped this lineup`;

export function venuesNote(
  placesListed: number | null,
  tested: number,
  city: string,
): string {
  const compared =
    placesListed !== null
      ? `Qloo listed ${placesListed} ${city} live-music places; the AI agent compared the fans of ${tested} of them with the headliners' fans.`
      : `The AI agent compared the fans of ${tested} ${city} venues with the headliners' fans.`;
  return `${compared} These venues stand for the town's taste: the acts won't necessarily play there.`;
}

export const liftedWords = (lifted: number) =>
  lifted === 0 ? "lifted none" : `${lifted === 1 ? "act" : "acts"} lifted`;

/** The controls one click deep, as the live screen labels them (inert in the lab). */
export const SECONDARY = {
  withQloo: "With Qloo: the AI agent's lineup",
  withoutQloo: "Without Qloo: an AI model's picks alone",
  csv: "Export CSV",
  order: "Running order",
  compare: "Compare with another town",
  method: "How it works",
} as const;

/** The bill's acts in billing order: the bands as the festival lists them, each in saved order. */
export function billed(festival: Festival, acts: readonly Act[]): Act[] {
  return festival.feeBands.flatMap((band) =>
    acts.filter((act) => act.band === band.id),
  );
}
