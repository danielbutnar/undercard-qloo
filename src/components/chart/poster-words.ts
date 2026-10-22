import { MIN_LIFT } from "@/lib/assemble-lineup";
import { feeBandFor, type FeeBand, type FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { Act } from "@/lib/lineup";
import type { PickCheck } from "@/lib/llm-only";
import { liftOf } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import type { Placed } from "@/lib/venue-switch";
import { ordinal } from "./words";

/**
 * What the first screen says (WS9, "Your town prints your poster"): the lead, the town's legend
 * and signs, the poster's lines and the Without Qloo checks, each worked out from the saved
 * build, its trace, the venue switch and prompt 4's checks. Nothing here holds a name or a number
 * of its own.
 */

/** The first screen's tagline: Qloo is explained in plain words where it's first named (M6r). */
export const TAGLINE_LEAD = "An AI agent for festival bookers, built on Qloo,";
export const TAGLINE_QLOO =
  "a taste-data service that maps what fans of one artist, venue or film also like.";

export const LEAD_TITLE = "You booked the headliners.";

/** The lead's second line: the marked words, then the rest of the sentence. */
export function leadLine(
  festival: Pick<Festival, "city">,
  without: boolean,
  counts?: WithoutCounts | null,
): { mark: string; rest: string } {
  if (!without)
    return {
      mark: "Undercard drafts the rest",
      rest: `from what fans of ${festival.city}'s music venues like.`,
    };
  const bigger = counts && counts.found > 0 && counts.above * 2 > counts.found;
  return {
    mark: bigger
      ? "Without Qloo, an AI picks bigger names"
      : "Without Qloo, an AI picks from what it already knows",
    rest: `and it can't see ${festival.city}'s venues.`,
  };
}

/** The town's legend over the scene: what the coloured and grey venues are. */
export function legendLine({
  city,
  placesListed,
  tested,
  lifting,
  without = false,
}: {
  city: string;
  /** Live-music places Qloo listed in the town, from the build's venue search. */
  placesListed: number | null;
  /** Venues whose fans the build read. */
  tested: number;
  /** Of those, the venues whose fans lifted an act onto the lineup. */
  lifting: number;
  without?: boolean;
}): { title: string; text: string } {
  if (without)
    return {
      title: "No venues read",
      text: "Without Qloo, the model has no venue's fans to read: its picks come from what it already knows.",
    };
  if (tested === 0)
    return {
      title: "No venues read yet",
      text: `Once the AI agent drafts the lineup, the ${city} venues whose fans it tested stand here.`,
    };
  const found =
    placesListed !== null
      ? `Qloo found ${placesListed} live-music ${placesListed === 1 ? "venue" : "venues"} in ${city}; the AI agent tested ${tested === 1 ? "this one" : `these ${tested}`}.`
      : `The AI agent chose ${tested === 1 ? "this venue" : "these venues"} to test.`;
  const key =
    lifting === tested
      ? "Coloured: their fans lifted acts onto your poster."
      : lifting === 0
        ? "Grey: their fans lifted no act onto your poster."
        : "Coloured: their fans lifted acts onto your poster. Grey: none did.";
  return { title: "Venues the agent tested", text: `${found} ${key}` };
}

/** A venue's sign in the town: its acts on the poster, or why it has none. */
export function signChip({
  lifted,
  off = false,
  unread = false,
}: {
  lifted: number;
  off?: boolean;
  unread?: boolean;
}): string {
  if (unread) return "not read yet";
  if (off) return "Fans off";
  if (lifted === 0) return "none";
  return lifted === 1 ? "1 act" : `${lifted} acts`;
}

/** A venue's switch on the poster, read out: on or off, and what it does. */
export const inkLabel = (venue: string, on: boolean, lifted: number) =>
  on
    ? `${venue}'s fans: on, ${lifted === 1 ? "1 act" : `${lifted} acts`}. Switch them off`
    : `${venue}'s fans: off. Switch them on`;

/** The poster's key under the venues: what the ↑ counts and which act takes a slot. */
export const RULE_LINE = `↑ = places it rose in Qloo's ranking with that venue's fans (${MIN_LIFT}+ to qualify); the strongest Qloo match takes each slot`;

/** A band's head on the poster: its Qloo popularity range, the first band saying what it stands for. */
export function bandRange(band: FeeBand, first: boolean): string {
  const range = `${Math.round(band.minPopularity * 100)}–${Math.round(band.maxPopularity * 100)}`;
  return `Qloo popularity ${range}${first ? ", our stand-in for fee" : ""}`;
}

/** An act's climb on its poster name, in the body face (Anton draws ↑ too small: marks.ts). */
export function climbMark(act: Pick<Act, "reason">): string | null {
  const lift = liftOf(act);
  if (!lift) return null;
  return lift.kind === "new" ? "NEW" : `↑${lift.places}`;
}

/**
 * The one-act sentence (WS9): how far the act climbed in Qloo's ranking once its venue's fans
 * joined the headliners' fans, from the saved build's places; null where the build can't tell.
 */
export function oneActLine(
  act: Pick<Act, "name" | "reason" | "anchorVenue">,
  place: Placed | null | undefined,
): string | null {
  const lift = liftOf(act);
  const venue = act.anchorVenue.name;
  if (lift?.kind === "new")
    return `${act.name} entered Qloo's top 50 at ${ordinal(place?.now ?? lift.top)} once ${venue}'s fans joined the headliners' fans.`;
  if (lift?.kind === "up" && place?.was)
    return `${act.name} climbed from ${ordinal(place.was)} to ${ordinal(place.now)} in Qloo's ranking once ${venue}'s fans joined the headliners' fans.`;
  return null;
}

/**
 * The act the poster's example line follows: the first act on the poster, band by band in the
 * order they print, whose climb the build can tell.
 */
export function exampleAct<
  A extends Pick<Act, "name" | "reason" | "anchorVenue" | "entityId">,
>(printed: readonly A[], places: Readonly<Record<string, Placed>>): A | null {
  return (
    printed.find((act) => oneActLine(act, places[act.entityId]) !== null) ??
    null
  );
}

/** The example line's hint: what to try next. */
export const exampleHint = (switchable: boolean) =>
  switchable
    ? "Pick a name for why, or switch a venue off above."
    : "Pick a name for why.";

/** A selected venue's line on the poster, in place of the example. */
export function venueLine(venue: string, lifted: number, off: boolean): string {
  if (off) return `${venue}'s fans are off, so its acts left your poster.`;
  if (lifted === 0) return `${venue}'s fans lifted no act onto your poster.`;
  return `${venue}'s fans lifted ${lifted === 1 ? "1 act" : `${lifted} acts`} onto your poster. Pick one for why.`;
}

const RANGE_NAME: Record<FeeBandId, string> = {
  mid: "mid-size",
  opener: "opening",
};

/** A band of slots in plain words: "mid-size", "opening". */
export const rangeName = (band: Pick<FeeBand, "id">) => RANGE_NAME[band.id];

/** Why a band's slots all stay open with venues switched off, and what brings them back. */
export function openBandLine({
  band,
  slots,
  on,
}: {
  band: Pick<FeeBand, "id">;
  slots: number;
  /** The venues whose fans are on. */
  on: readonly string[];
}): { head: string; text: string } {
  return {
    head: `The ${slots} ${RANGE_NAME[band.id]} slots stay open.`,
    text:
      on.length === 0
        ? `Every venue's fans are off, so no act rises ${MIN_LIFT} places.`
        : `No venue whose fans are on lifts ${band.id === "mid" ? "a mid-size" : "an opening"} act ${MIN_LIFT} places.`,
  };
}

/** Every slot open with venues switched off. */
export function openPosterLine({
  slots,
  on,
}: {
  slots: number;
  on: readonly string[];
}): { head: string; text: string } {
  return {
    head: `All ${slots} slots stay open.`,
    text:
      on.length === 0
        ? `Every venue's fans are off, so no act rises ${MIN_LIFT} places.`
        : `Only ${listNames(on)}'s fans are on, and they lift no act ${MIN_LIFT} places.`,
  };
}

/** "A", "A and B", "A, B and C". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The poster's stamp: the demo's festival is fictional; a judge's own is their draft. */
export const stampWords = (own: boolean) =>
  own ? "Draft, not announced" : "Fictional festival · demo draft";

/** The poster's last line. */
export function footnote(
  festival: Pick<Festival, "id">,
  anyNew: boolean,
): string {
  const demo =
    festival.id === SAGEBRUSH_SOUND.id
      ? "Fictional demo festival"
      : festival.id.startsWith(`${SAGEBRUSH_SOUND.id}-`)
        ? `Fictional demo festival, the same brief as ${SAGEBRUSH_SOUND.city}'s`
        : null;
  const key = anyNew ? "NEW = rose into Qloo's top 50" : null;
  return [demo, key].filter(Boolean).join(" · ");
}

/** Under Watch: what the replay shows, and how many Qloo calls it replays. */
export function watchSubLine({
  city,
  calls,
  live,
}: {
  city: string;
  calls: number | null;
  /** No saved build: Watch runs the AI agent. */
  live: boolean;
}): string {
  if (live) return "Runs the AI agent; its Qloo calls list below";
  const many = calls !== null ? `, in its ${calls} Qloo calls` : "";
  return `Replays how the agent drafted ${city}${many}`;
}

/** The Watch button's label (the layout brief's words for the first click). */
export const WATCH_AGENT = "Watch the AI agent build it";

/** A pick's tag on the Without Qloo poster (prompt 4's checks, docs/evidence.md section 31). */
export function pickTag(
  check: PickCheck | undefined,
  festival: Pick<Festival, "feeBands">,
): string {
  if (!check || check.status === "not-checked") return "not checked on Qloo";
  if (check.status === "not-found") return "not on Qloo";
  const bands = [...festival.feeBands].sort(
    (a, b) => a.minPopularity - b.minPopularity,
  );
  const down = (popularity: number) => Math.floor(popularity * 100 + 1e-9);
  const every = bands.length === 2 ? "both ranges" : "every range";
  if (check.range === "above") {
    const top = bands[bands.length - 1];
    const percent = Math.max(
      down(check.popularity),
      down(top.maxPopularity) + 1,
    );
    return `${ordinal(percent)} · above ${every}`;
  }
  if (check.range === "below")
    return `${ordinal(down(check.popularity))} · below ${every}`;
  const band = feeBandFor(check.popularity, bands) ?? bands[0];
  return `${ordinal(down(check.popularity))} · in the ${RANGE_NAME[band.id]} range`;
}

/** What prompt 4's checks found for one town's model picks, counted. */
export interface WithoutCounts {
  picks: number;
  /** Found on Qloo. */
  found: number;
  above: number;
  below: number;
  inRange: Partial<Record<FeeBandId, number>>;
  notFound: number;
  notChecked: number;
  /** The picks that climb with one of the town's venues, by name, in the model's order. */
  climbers: string[];
}

export function withoutCounts(
  picks: readonly { name: string }[],
  checks: readonly PickCheck[] | undefined,
  festival: Pick<Festival, "feeBands">,
): WithoutCounts {
  const byName = new Map(checks?.map((check) => [check.name, check]));
  const counts: WithoutCounts = {
    picks: picks.length,
    found: 0,
    above: 0,
    below: 0,
    inRange: {},
    notFound: 0,
    notChecked: 0,
    climbers: [],
  };
  for (const pick of picks) {
    const check = byName.get(pick.name);
    if (!check || check.status === "not-checked") counts.notChecked++;
    else if (check.status === "not-found") counts.notFound++;
    else {
      counts.found++;
      if (check.range === "above") counts.above++;
      else if (check.range === "below") counts.below++;
      else {
        const band = feeBandFor(check.popularity, festival.feeBands);
        if (band) counts.inRange[band.id] = (counts.inRange[band.id] ?? 0) + 1;
      }
      if (check.climb !== null && check.climb > 0)
        counts.climbers.push(pick.name);
    }
  }
  return counts;
}

/** The Without Qloo poster's headline, while any pick sits above every range; null otherwise. */
export function withoutHeadline(counts: WithoutCounts): string | null {
  if (counts.above === 0) return null;
  return `By Qloo popularity, ${counts.above} of its ${counts.picks} picks ${counts.above === 1 ? "is" : "are"} too big for these slots`;
}

/** The scene's note while Without Qloo is on: the model can't see the town's venues. */
export function withoutNote(
  festival: Pick<Festival, "city">,
  counts: WithoutCounts | null,
): { title: string; text: string } {
  const bigger =
    counts && counts.above > 0
      ? `, and by Qloo popularity ${counts.above} of its ${counts.picks} picks ${counts.above === 1 ? "is" : "are"} too big for these slots`
      : "";
  return {
    title: `Without Qloo, the model can't see ${festival.city}'s venues.`,
    text: `Same model as the agent (Claude Sonnet 5.5), same brief, no Qloo: it picks without reading any venue's fans${bigger}.`,
  };
}

/**
 * The checks summed up under the picks: what fits a range, what Qloo doesn't know, and which
 * picks climb with a venue's fans. It never says that none climbs: a pick may.
 */
export function withoutSummary(
  festival: Pick<Festival, "city" | "feeBands">,
  counts: WithoutCounts,
): string | null {
  if (counts.found + counts.notFound === 0) return null;
  const parts: string[] = [];
  for (const band of festival.feeBands) {
    const n = counts.inRange[band.id] ?? 0;
    if (n > 0)
      parts.push(
        `${n} ${n === 1 ? "fits" : "fit"} the ${RANGE_NAME[band.id]} range`,
      );
  }
  if (counts.above > 0)
    parts.push(
      `${counts.above} ${counts.above === 1 ? "sits" : "sit"} above both ranges`,
    );
  if (counts.below > 0)
    parts.push(
      `${counts.below} ${counts.below === 1 ? "sits" : "sit"} below both ranges`,
    );
  if (counts.notFound > 0)
    parts.push(
      `${counts.notFound} ${counts.notFound === 1 ? "name had" : "names had"} no Qloo match`,
    );
  const climbs =
    counts.climbers.length > 0
      ? `; ${counts.climbers.length} of the ${counts.picks} ${counts.climbers.length === 1 ? "climbs" : "climb"} with a ${festival.city} venue's fans: ${listNames(counts.climbers)}`
      : "";
  return `Checked on Qloo afterwards: ${listNames(parts)}${climbs}.`;
}

/** The Without Qloo list's head: the model's picks have no slots (docs/evidence.md section 31). */
export const modelPicksTitle = (picks: number) =>
  `The model's ${picks} ${picks === 1 ? "pick" : "picks"}`;

/** The ruler over the picks: where Qloo's popularity puts each one, against the slot ranges. */
export function rulerTitle(counts: WithoutCounts): string {
  const missing = counts.notFound + counts.notChecked;
  const note =
    missing > 0
      ? ` (${missing} ${missing === 1 ? "name" : "names"} not placed on Qloo)`
      : "";
  return `Qloo popularity, our stand-in for fee: where the model's picks sit${note}`;
}

/**
 * Each US state's postal code, for a town's chip ("BOISE ID"); null for a region without one,
 * whose chip then shows the town alone.
 */
const US_STATES: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

export const regionCode = (region: string): string | null =>
  US_STATES[region] ?? null;
