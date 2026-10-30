import type { RefillReceipt } from "@/lib/build-state";
import { feeBandFor, type FeeBand, type FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { Act } from "@/lib/lineup";
import type { PickCheck } from "@/lib/llm-only";
import { liftOf } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { UNAVAILABLE_REASONS } from "@/lib/unavailable";
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
): { mark: string; rest: string } {
  if (!without)
    return {
      mark: "Undercard drafts the rest",
      rest: `from what fans of ${festival.city}'s music venues like.`,
    };
  // The headline never grades the model on a number it never saw (WS8).
  return {
    mark: "Without Qloo, an AI picks",
    rest: `without seeing ${festival.city}'s venues.`,
  };
}

/**
 * A venue in the town's note: the acts its fans put on the bill on screen, whether its fans are
 * switched off, and whether Qloo had fan data for it.
 */
export interface NoteVenue {
  name: string;
  lifted: number;
  off?: boolean;
  noFanData?: boolean;
}

/** The town's note is one sentence of at most this many words (WS18 item 2). */
export const NOTE_WORDS = 25;

/** A venue's name as its sign and the poster's key print it (town-scene.tsx's signName). */
const shownName = (name: string) =>
  name.replace(/\s*\([^)]*\)/g, "").trim() || name;
/** "Venue 227's"; a name that already ends in 's keeps it ("Venue 225"). */
const whose = (name: string) => (/['’]s$/.test(name) ? name : `${name}'s`);
const andList = (parts: readonly string[]) =>
  parts.length < 2
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
const actsWord = (n: number) =>
  n === 0 ? "no act" : n === 1 ? "1 act" : `${n} acts`;

/**
 * The town's note (WS18 item 2, Daniel, 29 Oct): one sentence of at most 25 words, from the
 * build on screen, as "Venue 227's fans lifted N acts onto this lineup and Visual Arts
 * Collective's 2; Qloo had no fan data for Venue 166 Boise" ("lineup", not "bill": the
 * first screen keeps M6r's rule, Daniel at 20:40). The colour key stays on the poster. Where a
 * town's names run long, it drops "onto this lineup", then counts the venues Qloo had no fan data
 * for and those switched off, then all but the strongest venue, rather than name them.
 */
function townNote(venues: readonly NoteVenue[]): string {
  const on = venues.filter((venue) => !venue.off);
  const named = [
    ...on
      .filter((venue) => venue.lifted > 0)
      .sort((a, b) => b.lifted - a.lifted),
    ...on.filter((venue) => venue.lifted === 0 && !venue.noFanData),
  ];
  const fanless = on.filter((venue) => venue.lifted === 0 && venue.noFanData);
  const off = venues.filter((venue) => venue.off);
  const draft = (bill: boolean, counted: boolean, strongest: boolean) => {
    const lead = strongest ? named.slice(0, 1) : named;
    const rest = named.slice(lead.length);
    const restActs = rest.reduce((sum, venue) => sum + venue.lifted, 0);
    const clauses: string[] = [];
    if (lead.length > 0) {
      const [first, ...others] = lead;
      clauses.push(
        andList([
          `${whose(shownName(first.name))} fans lifted ${actsWord(first.lifted)}${bill ? " onto this lineup" : ""}`,
          ...others.map(
            (venue) =>
              `${whose(shownName(venue.name))} ${venue.lifted || "none"}`,
          ),
          ...(rest.length > 0
            ? [
                `${rest.length === 1 ? "one more venue's" : `${rest.length} more venues'`} ${restActs || "none"}`,
              ]
            : []),
        ]),
      );
    }
    if (fanless.length > 0)
      clauses.push(
        `Qloo had no fan data for ${
          counted
            ? fanless.length === 1
              ? "one more"
              : `${fanless.length} more`
            : andList(fanless.map((venue) => shownName(venue.name)))
        }`,
      );
    if (off.length > 0)
      clauses.push(
        `${
          counted
            ? off.length === 1
              ? "one venue's"
              : `${off.length} venues'`
            : andList(off.map((venue) => whose(shownName(venue.name))))
        } fans are switched off`,
      );
    const text = `${clauses.join("; ")}.`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
  for (const [bill, counted, strongest] of [
    [true, false, false],
    [false, false, false],
    [false, true, false],
    [false, true, true],
  ] as const) {
    const text = draft(bill, counted, strongest);
    if (wordCount(text) <= NOTE_WORDS) return text;
  }
  // Names longer than the note itself: the counts alone.
  const total = named.reduce((sum, venue) => sum + venue.lifted, 0);
  return `${venues.length === 1 ? "One venue's" : `${venues.length} venues'`} fans lifted ${actsWord(total)} onto this lineup.`;
}

/** The town's legend over the scene: each venue the build read, and what its fans put on the bill. */
export function legendLine({
  city,
  venues,
  without = false,
}: {
  city: string;
  /** The venues whose fans the build read, as the town stands them. */
  venues: readonly NoteVenue[];
  without?: boolean;
}): { title: string; text: string } {
  if (without)
    return {
      title: "No venues read",
      text: "Without Qloo, the model has no venue's fans to read: its picks come from what it already knows.",
    };
  if (venues.length === 0)
    return {
      title: "No venues read yet",
      text: `Once the AI agent drafts the lineup, the ${city} venues whose fans it tested stand here.`,
    };
  return { title: "Venues the agent tested", text: townNote(venues) };
}

/** A venue's sign in the town: its acts on the poster, or why it has none. */
export function signChip({
  lifted,
  off = false,
  unread = false,
  noFanData = false,
}: {
  lifted: number;
  off?: boolean;
  unread?: boolean;
  /** Qloo had no fan data for the venue (WS8). */
  noFanData?: boolean;
}): string {
  if (unread) return "not read yet";
  if (off) return "Fans off";
  if (lifted === 0) return noFanData ? "no fan data" : "none";
  return lifted === 1 ? "1 act" : `${lifted} acts`;
}

/** A venue's switch on the poster, read out: on or off, and what it does. */
export const inkLabel = (
  venue: string,
  on: boolean,
  lifted: number,
  noFanData = false,
) =>
  on
    ? noFanData
      ? `${venue}'s fans: no fan data on Qloo. Switch them off`
      : `${venue}'s fans: on, ${lifted === 1 ? "1 act" : `${lifted} acts`}. Switch them off`
    : `${venue}'s fans: off. Switch them on`;

/** The poster's key under the venues: what the ↑ counts and which act takes a slot. */
/** Under the poster's key, in Daniel's words (2026-10-28): what the venues are, and aren't. */
export const KEY_SIGNAL =
  "These venues' fans are the signal: the acts won't necessarily play there.";

// The marks only: the three checks, with their bars, follow the acts (PosterChecks, WS18 item 1).
export const RULE_LINE =
  "↑ = places it rose in Qloo's ranking with that venue's fans";

/** What NEW on an act means (the poster's mark for an act new to Qloo's top 50). */
export const NEW_KEY = "NEW = rose into Qloo's top 50";

/**
 * The key line, with NEW defined beside ↑ where an act on the poster is new to the top 50
 * (WS12 item 7: a reader looks for what the marks mean there).
 */
export const ruleLine = (anyNew: boolean) =>
  anyNew ? `${RULE_LINE}; ${NEW_KEY}` : RULE_LINE;

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
 * The last refill's receipt on the poster (WS18 item 3, Daniel, 29 Oct), as "Act 111 out
 * (routing) → Act 124, Nth, NEW · from the rankings already read, no new Qloo call".
 */
export function receiptLine(receipt: RefillReceipt): string {
  const why = receipt.reason ? ` (${UNAVAILABLE_REASONS[receipt.reason]})` : "";
  const where = [
    receipt.place ? ordinal(receipt.place.now) : null,
    climbMark(receipt.in),
  ].filter(Boolean);
  const from =
    receipt.calls === 0
      ? "from the rankings already read, no new Qloo call"
      : `from ${receipt.calls} new Qloo ${receipt.calls === 1 ? "call" : "calls"}`;
  const fee = receipt.feeFallback
    ? ` · no act below ${receipt.out.name}'s popularity passed: the strongest that does took the slot`
    : "";
  return `${receipt.out.name} out${why} → ${receipt.in.name}${where.length ? `, ${where.join(", ")}` : ""} · ${from}${fee}`;
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

/**
 * With a venue switched off, an act the re-formed poster books that the saved one doesn't: why
 * it wasn't there before.
 */
export const MISSED_CUT =
  "With every venue on, it missed the cut: the strongest Qloo match fills each slot first.";

/** The act card's slot line: "Mid-size act", "Opening act". */
export const cardBand = (band: Pick<FeeBand, "id">) =>
  band.id === "mid" ? "Mid-size act" : "Opening act";

/** The act card's heading over the three checks every act on the poster passed. */
export const CARD_CHECKS = "Why it's on your poster";

/** Under the fee check: the tier's range on Qloo's scale, our stand-in for fee. */
export function cardPopularityLine(band: FeeBand | undefined): string {
  if (!band) return "Qloo popularity stands in for its fee.";
  const low = Math.round(band.minPopularity * 100);
  const high = Math.round(band.maxPopularity * 100);
  return `The ${RANGE_NAME[band.id]} range is ${low}–${high} out of 100 on Qloo, our stand-in for fee.`;
}

/** Under the checks: which act a slot goes to when several pass. */
export const CARD_STRONGEST =
  "Of the acts that pass all three, the strongest Qloo match fills each slot first.";

/**
 * A venue card's second line (WS8): what the AI agent read the venue's fans for, or tried it for
 * when Qloo had no fan data; never the count of venues it chose from.
 */
export function venueReadLine(
  read: readonly string[],
  noFanData: boolean,
): string {
  const did = noFanData ? "tried it" : "read its fans";
  if (read.length === 0) return `The AI agent ${did}.`;
  return `The AI agent ${did} for ${read.length > 1 ? "both slot sizes" : read[0]}.`;
}

/** The example line's hint: what to try next. */
export const exampleHint = (switchable: boolean) =>
  switchable
    ? "Pick a name for why, or switch a venue off above."
    : "Pick a name for why.";

/** A selected venue's line on the poster, in place of the example. */
export function venueLine(
  venue: string,
  lifted: number,
  off: boolean,
  noFanData = false,
): string {
  if (off) return `${venue}'s fans are off, so its acts left your poster.`;
  if (lifted === 0)
    return noFanData
      ? `Qloo had no fan data for ${venue}, so it lifted no act onto your poster.`
      : `${venue}'s fans lifted no act onto your poster.`;
  return `${venue}'s fans lifted ${lifted === 1 ? "1 act" : `${lifted} acts`} onto your poster. Pick one for why.`;
}

const RANGE_NAME: Record<FeeBandId, string> = {
  mid: "mid-size",
  opener: "opening",
};

/** A band of slots in plain words: "mid-size", "opening". */
export const rangeName = (band: Pick<FeeBand, "id">) => RANGE_NAME[band.id];

/**
 * Why a band's slots all stay open with venues switched off, and what brings them back (WS8, the
 * brief's item 12): the venues the draft read for those slots, those of them Qloo had no fan data
 * for, and the venues off. It says no act passes the rule, which is what the re-formed lineup
 * shows; an act can climb 5 places and still miss the fee range or the genres.
 */
export function openBandLine({
  band,
  slots,
  read,
  noFanData,
  off,
}: {
  band: Pick<FeeBand, "id">;
  slots: number;
  /** The venues this draft read for the band's slots, by their full names. */
  read: readonly string[];
  /** Those of them Qloo had no fan data for, by their full names. */
  noFanData: readonly string[];
  /** The venues switched off, by their short names. */
  off: readonly string[];
}): { head: string; text: string; fix: string } {
  const size = RANGE_NAME[band.id];
  const lacking = read.filter((name) => noFanData.includes(name));
  const readWords = read.length
    ? `For ${size} acts this draft read ${listNames(read.map((name) => `${name}'s`))} fans${
        lacking.length
          ? `, and Qloo had no fan data for ${listNames(lacking)}`
          : ""
      }. `
    : "";
  return {
    head: `The ${slots} ${size} slots stay open.`,
    text: `${readWords}With ${listNames(off)} off, no act passes the rule for these slots.`,
    fix:
      off.length === 1
        ? `Switch ${off[0]} back on`
        : "Switch the venues back on",
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
        ? "Every venue's fans are off, so no act passes the rule."
        : `Only ${listNames(on)}'s fans are on, and no act passes the rule.`,
  };
}

/** "A", "A and B", "A, B and C". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * The poster's stamp: the demo's festival is fictional; a judge's own is their draft. A phone
 * sets the short form.
 */
export const stampWords = (own: boolean, short = false) =>
  own ? "Draft" : short ? "Fictional demo" : "Fictional festival · demo draft";

/** The poster's last line. */
export function footnote(
  festival: Pick<Festival, "id">,
  anyNew: boolean,
): string {
  const demo =
    festival.id === SAGEBRUSH_SOUND.id
      ? "Fictional demo festival"
      : festival.id.startsWith(`${SAGEBRUSH_SOUND.id}-`)
        ? "Fictional demo festival: the same headliners and slot sizes in every town"
        : null;
  const key = anyNew ? NEW_KEY : null;
  return [demo, key].filter(Boolean).join(" · ");
}

/**
 * Under Watch: what it replays, in one line on a phone too (the layout brief's words); the
 * poster counts the calls ("Drafted from 12 Qloo calls").
 */
export function watchSubLine({
  city,
  live,
  onScreen = true,
}: {
  city: string;
  /** No saved build: Watch runs the AI agent. */
  live: boolean;
  /** The saved build Watch replays is the one on screen; false once a live run replaced it. */
  onScreen?: boolean;
}): string {
  if (live) return "Runs the AI agent; its Qloo calls list below";
  if (!onScreen) return "Replays the saved build's Qloo calls";
  return `Replays how the agent drafted ${city}`;
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
    return `${percent}/100 · above ${every}`;
  }
  if (check.range === "below")
    return `${down(check.popularity)}/100 · below ${every}`;
  const band = feeBandFor(check.popularity, bands) ?? bands[0];
  return `${down(check.popularity)}/100 · in the ${RANGE_NAME[band.id]} range`;
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

/**
 * The scene's note while Without Qloo is on: the model can't see the town's venues. Like the
 * headline (item 10), it never grades the model on Qloo's popularity, a number it never saw;
 * the ruler and the stamps show that.
 */
export function withoutNote(festival: Pick<Festival, "city">): {
  title: string;
  text: string;
} {
  return {
    title: `Without Qloo, the model can't see ${festival.city}'s venues.`,
    text: "Same model as the agent (Claude Sonnet 5.5), same brief, no Qloo: it picks without reading any venue's fans.",
  };
}

/**
 * The checks summed up under the picks: what fits a range, what sits below them, what Qloo
 * doesn't know, and which picks climb with a venue's fans (the headline and the ruler say what
 * sits above). It never says that none climbs: a pick may.
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

/**
 * Without Qloo's line under the dot chart (Daniel, 2026-10-29, WS18 item 4): what the model alone
 * did at real festivals (section 38) and what it can't do here, N counted from this answer.
 */
export function modelLine(
  city: string,
  counts: Pick<WithoutCounts, "picks" | "above">,
): string {
  return `At 33 real festivals, the model alone named more of the acts the festivals booked than Undercard did, 11 to 3 (section 38). It can't read ${city}'s venue fans, and ${counts.above} of these ${counts.picks} picks ${counts.above === 1 ? "sits" : "sit"} above the popularity range that stands in for the fee.`;
}

/** Under that line: the pitch check on the model's picks (WS18 item 4). */
export const CHECK_PICKS = "Check its picks on Qloo →";

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
