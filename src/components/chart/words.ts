import type { AgentSwitch } from "@/lib/agent-switch";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { TraceCall } from "@/lib/build-events";
import { feeBandFor, type FeeBand, type FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { ClimbEvent } from "@/lib/lift-climb";
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

/**
 * Watch's banner over the chart (festival-screen.tsx's EditionBanner): whose fans this edition
 * adds, what it shows, the Qloo call it came from and the AI agent's line. `first` is the banner
 * before the first edition; `lifted` counts the acts on the lineup from this edition's venue,
 * null until the lineup is in.
 */
export interface WatchEdition {
  first: boolean;
  step: ClimbEvent | null;
}

export function watchTitle({
  first,
  step,
  replayed,
  headliners,
}: WatchEdition & {
  replayed: boolean;
  headliners: readonly string[];
}): string {
  if (first || !step)
    return replayed
      ? "Replaying the AI agent's build"
      : "The AI agent is planning its Qloo calls";
  return step.venue
    ? `+ ${step.venue.name}'s fans`
    : `${headliners.join(" + ")} fans alone`;
}

/** A venue Qloo had no fan data for (src/lib/fan-data.ts): its edition says so (WS2). */
export const NO_FAN_DATA_WATCH =
  "Qloo had no fan data for this venue, so its ranking stays the headliners' own.";

export function watchLine({
  first,
  step,
  lifted,
  noFanData = false,
}: WatchEdition & {
  lifted: number | null;
  /** Qloo had no fan data for this edition's venue. */
  noFanData?: boolean;
}): string {
  if (first || !step)
    return "First it finds the headliners and the town's music venues in Qloo.";
  if (!step.venue)
    return "Qloo ranks the artists the headliners' fans like: the chart before any venue.";
  // A live run sends its lineup after its last call: until then, the edition's own climbs.
  const climbs = step.acts.filter((listed) => listed.move !== null).length;
  if (noFanData && (lifted === null ? climbs === 0 : lifted === 0))
    return NO_FAN_DATA_WATCH;
  if (lifted === null)
    return climbs > 0
      ? `Qloo's ranking re-sorts with this venue's fans added: ${climbs} of the top ${step.acts.length} ${climbs === 1 ? "climbs" : "climb"} ${MIN_LIFT} places or more.`
      : `Qloo's ranking re-sorts with this venue's fans added: no act in view climbs ${MIN_LIFT} places.`;
  return lifted > 0
    ? `Qloo's ranking re-sorts with this venue's fans added: ${lifted} ${lifted === 1 ? "act climbs" : "acts climb"} onto the lineup.`
    : `Qloo's ranking re-sorts with this venue's fans added: no act climbs ${MIN_LIFT} places onto the lineup.`;
}

/**
 * A saved call's line in today's words (WS8): a fee range is a tier, never a band ("Mid-tier
 * artists for the headliners and …"); the saved line itself keeps its words, which the app parses.
 */
export const callWords = (summary: string) =>
  summary.replace(/\b(Mid|Opener)-band\b/g, "$1-tier");

export const watchCallLine = (
  call: Pick<TraceCall, "n" | "summary" | "resultCount">,
  shown: number,
) =>
  `Qloo call ${call.n} of ${shown}: ${callWords(call.summary)}${call.resultCount !== null ? ` · ${call.resultCount} results` : ""}`;

export const watchTicksLabel = (calls: number, shown: number) =>
  `${calls} of ${shown} Qloo calls in`;

/** The AI agent's own line from the trace, as Watch's banner sets it under an edition. */
export const agentLine = (note: string) => `The AI agent's plan: ${note}`;

/** Whether a line of the agent's says "Anchors": the first such line gets ANCHORS_KEY under it. */
export const saysAnchors = (note: string) => /\banchors\b/i.test(note);
export const ANCHORS_KEY = "Anchors are the venues whose fans it reads.";

/**
 * The agent's switch, from the saved trace only (src/lib/agent-switch.ts): the venue read before
 * the planner's line moved no act onto the lineup, and the line named the next venue read. Where
 * Qloo had no fan data for that venue (`noFanData`, entity ids), the sentence says so instead.
 */
export function switchLine(
  {
    from,
    to,
    acts,
    because,
  }: Pick<AgentSwitch, "from" | "to" | "acts" | "because">,
  noFanData: readonly string[] = [],
): string {
  const come =
    acts === 0
      ? "No act comes"
      : acts === 1
        ? "1 act comes"
        : `${acts} acts come`;
  // A 2.0 build (WS13.1): Qloo's warning reached the agent, so the reason is true.
  if (because === "no-fan-data")
    return `Qloo had no fan data for ${from.name}, so the agent read ${to.name}. ${come} from that read.`;
  // The order, not a reason (WS8): a 1.0 agent didn't see Qloo's no-fan-data warning.
  return noFanData.includes(from.entityId)
    ? `Qloo had no fan data for ${from.name}; the agent read ${to.name} next. ${come} from that read.`
    : `${from.name}'s fans moved no act onto the lineup; the agent read ${to.name} next. ${come} from that read.`;
}

/** How it works' line for the venues the agent read that Qloo had no fan data for (WS2). */
export const noFanDataLine = (names: readonly string[]) =>
  names.length === 1
    ? `${names[0]}: the agent read it too, but Qloo had no fan data for it.`
    : `${names.join(" and ")}: the agent read them too, but Qloo had no fan data for them.`;

/** Where the saved trace holds no line of the agent's for a step: what it decides, never a reason. */
export const AGENT_DECIDES =
  "The AI agent chose which venues to read, and in what order; Qloo's numbers and the rule pick the acts.";

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
