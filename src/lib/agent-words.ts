import { QLOO_CALL_CAP } from "./agent-limits";
import { FEE_BAND_IDS, type FeeBand, type FeeBandId } from "./fee-bands";
import {
  formatAffinity,
  formatPopularity,
  formatPopularityRange,
} from "./format";
import type { Act, LocationReading } from "./lineup";
import type { LocalPick } from "./local-pick";

/*
 * Agent 2.0's words (WS13): the lines its new trace data gives the Qloo calls list, Watch and the
 * setlist. WS13 writes them; where they sit on a page is WS12's.
 */

/**
 * A place the planner skipped as not a music venue, with its reason (Daniel, 2026-10-28, 19:10):
 * one of the planner's lines, so the trace, the saved build and the setlist all say it.
 */
export const skippedLine = (place: string, reason: string) =>
  `Skipped ${place}: listed by Qloo, but ${reason.trim()}`;

/** The first words of a refusal's line, by which a comparison counts them (Daniel, 19:20). */
export const REFUSED_PREFIX = "Tried to stop after ";

/**
 * A stop refused before two music venues with fan data were read (Daniel, 2026-10-28): one of
 * the run's decision lines, saved with the build and replayed.
 */
export const refusedLine = (read: number, untried: readonly string[]) =>
  `${REFUSED_PREFIX}${read} music ${read === 1 ? "venue" : "venues"} with fan data; refused: two are needed.${untried.length > 0 ? ` Not tried yet: ${untried.join(", ")}.` : ""}`;

/** A venue read's line, when Qloo had no fan data for the venue (WS13.1). */
export const noFanDataCallLine = (venue: string) =>
  `Qloo had no fan data for ${venue}: the agent skips it.`;

/** Why the agent stopped reading venues (WS13.2). */
export const STOP_REASONS = ["full", "rooms", "cap", "planner"] as const;
export type StopReason = (typeof STOP_REASONS)[number];
export interface StopLine {
  reason: StopReason;
  text: string;
}

const SLOT_WORDS: Record<FeeBandId, [one: string, many: string]> = {
  mid: ["mid-size slot", "mid-size slots"],
  opener: ["opening slot", "opening slots"],
};

/** "1 mid-size slot and 2 opening slots stay open". */
function openWords(open: Record<FeeBandId, number>): string {
  const bands = FEE_BAND_IDS.filter((band) => open[band] > 0);
  const total = bands.reduce((sum, band) => sum + open[band], 0);
  const parts = bands.map(
    (band) => `${open[band]} ${SLOT_WORDS[band][open[band] === 1 ? 0 : 1]}`,
  );
  return `${parts.join(" and ")} ${total === 1 ? "stays" : "stay"} open`;
}

/**
 * The trace's last line (WS13.2): why the agent stopped, with the slots still open. A count it
 * gives is the trace's own total (Daniel, 2026-10-28): the calls when the agent stopped reading
 * venues, then the reads of Qloo's location signal that followed, and their sum.
 */
export function stopLine({
  reason,
  calls,
  located = 0,
  cap,
  city,
  open,
}: {
  reason: StopReason;
  /** Qloo calls when the agent stopped reading venues. */
  calls: number;
  /** Reads of Qloo's location signal after that (WS13.4), inside the cap. */
  located?: number;
  cap: number;
  city: string;
  open: Record<FeeBandId, number>;
}): string {
  const count =
    located > 0
      ? `after ${calls} of its ${cap} Qloo calls, then ${located} ${located === 1 ? "read" : "reads"} of Qloo's location signal for the cards (${calls + located} in all)`
      : `after ${calls} of its ${cap} Qloo calls`;
  switch (reason) {
    case "full":
      return `The agent stopped reading venues: every tier is full, ${count}.`;
    case "rooms":
      return `The agent stopped after trying every music venue Qloo listed in ${city}: ${openWords(open)}.`;
    case "cap":
      return `The agent stopped at its cap of ${cap} Qloo calls: ${openWords(open)}.`;
    case "planner":
      return `The agent stopped before every tier was full: ${openWords(open)}.`;
  }
}

/**
 * Said after the stop line when fewer than two music venues with fan data were read (Daniel,
 * 2026-10-28): of the town when every music venue it listed was tried, else of the reading.
 */
export function fewRoomsLine(
  city: string,
  { fanData, allTried }: { fanData: number; allTried: boolean },
): string | null {
  if (fanData >= 2) return null;
  if (allTried)
    return fanData === 1
      ? `Only one music venue in ${city} had fan data.`
      : `No music venue in ${city} had fan data.`;
  return fanData === 1
    ? "Only one music venue with fan data was read."
    : "No music venue with fan data was read.";
}

/**
 * Why a run stopped, from what is true, not only what the planner says: every tier full by the
 * rule; else the cap spent; else the planner's word that it tried every music venue; else it
 * stopped early.
 */
export function stopOf({
  open,
  calls,
  located,
  cap,
  city,
  claimed,
  rooms,
}: {
  open: Record<FeeBandId, number>;
  calls: number;
  located?: number;
  cap: number;
  city: string;
  claimed?: "every_band_full" | "tried_every_music_room";
  /** Music venues read with fan data, and whether every one listed was tried (Daniel, 2026-10-28). */
  rooms?: { fanData: number; allTried: boolean };
}): StopLine {
  const reason: StopReason = FEE_BAND_IDS.every((band) => open[band] === 0)
    ? "full"
    : calls >= cap
      ? "cap"
      : claimed === "tried_every_music_room"
        ? "rooms"
        : "planner";
  const few = rooms ? fewRoomsLine(city, rooms) : null;
  const line = stopLine({ reason, calls, located, cap, city, open });
  return { reason, text: few ? `${line} ${few}` : line };
}

/** The card's line for Qloo's location signal (WS13.4): a second reading, never the basis. */
export const locationLine = ({ town, withSignal, without }: LocationReading) =>
  `Second reading, outside the rule: with Qloo's location signal for ${town}, affinity ${formatAffinity(withSignal)} (${formatAffinity(without)} without).`;

/** The local pick's box (WS13.5): its region's name and its title. */
export const LOCAL_PICK_LABEL = "The AI's local pick";
export const LOCAL_PICK_TITLE = "The AI's local pick, for you to check";

/**
 * Under the title: who named the acts, how, and that they take no slot on their own; "unless you
 * add it" only while one of them can be added (a pick above both tiers can't).
 */
export const localPickIntro = (city: string, count: number, addable = count) =>
  count === 1
    ? `The AI agent named this act from what it knows of ${city}'s music, then found it on Qloo. Qloo's venue numbers and the rule didn't pick it, and it takes no slot${addable > 0 ? " unless you add it" : ""}.`
    : `The AI agent named these acts from what it knows of ${city}'s music, then found them on Qloo. Qloo's venue numbers and the rule didn't pick them, and ${addable > 0 ? "each takes no slot unless you add it" : "they take no slot"}.`;

/** A local pick above both tiers (Daniel, 2026-10-28): still shown, never offered for the bill. */
export const LOCAL_PICK_ABOVE =
  "above both tiers: headliner-sized, not for this bill";

const RANGE_WORDS: Record<FeeBandId, string> = {
  mid: "mid-size",
  opener: "opening",
};

/** Qloo's numbers for a local pick: its popularity against the tiers, and genres shared. */
export function localPickNumbers(
  pick: Pick<LocalPick, "popularity" | "band" | "range" | "sharedTags">,
  bands: readonly FeeBand[],
): string {
  const band = bands.find((entry) => entry.id === pick.band);
  const where = band
    ? `inside the ${RANGE_WORDS[band.id]} range (${formatPopularityRange(band)})`
    : pick.range === "above"
      ? LOCAL_PICK_ABOVE
      : `${pick.range} the fee ranges`;
  const names = pick.sharedTags.slice(0, 2).map((tag) => tag.name);
  const genres = names.length
    ? `shares ${names.join(" and ")} with the headliners`
    : "shares no genre with the headliners";
  return `Popularity ${formatPopularity(pick.popularity)} on Qloo, ${where} · ${genres}`;
}

/** The AI's own reason, said as its. */
export const localPickWhy = (why: string) => `The AI's reason: ${why}`;

/** Once the buyer adds a local pick. */
export const ON_THE_BILL =
  "On your bill, added by you; it goes out with Export CSV.";

/** The CSV's reason for a local pick the buyer added. */
export const LOCAL_PICK_ADDED = "Added by you: the AI's local pick";

/**
 * The agent's line for a step of Watch (WS13.7): the read's own line when the call carries one,
 * else the planner's latest line, else none, and only an old run with none gets the fallback.
 */
export const agentLineFor = ({
  call,
  note,
}: {
  call: { why?: string } | null;
  note: string | null;
}): string | null => call?.why ?? note ?? null;

/** Under Watch on every town (WS13.8): a fresh run of the AI agent, rate-limited. */
export const RUN_IT_LIVE = "Run it live";

/** What a live run is and costs, under its button. */
export const runItLiveSub = (city: string) =>
  `The AI agent drafts ${city} again now, with up to ${QLOO_CALL_CAP} Qloo calls. Live runs are limited each day.`;

/** Once a live run ends: its time and its Qloo calls. */
export const liveRunFacts = ({ calls, ms }: { calls: number; ms: number }) =>
  `This live run took ${(ms / 1000).toFixed(1)} s and ${calls} Qloo ${calls === 1 ? "call" : "calls"}.`;

const climbWord = (places: number) =>
  places > 0 ? `↑${places}` : places < 0 ? `↓${-places}` : null;

/**
 * The card's line on both climbs (WS13.3): with the town venue's fans, and with its control's,
 * worded as what it is (Daniel, 2026-10-28): a room in the control town with similar Qloo
 * popularity, never "matched". Null on a 1.0 act, which has no control.
 */
export function climbsLine(
  act: Pick<Act, "anchorVenue" | "localLift">,
): string | null {
  if (!act.localLift) return null;
  const { venueClimb, controlClimb } = act.localLift;
  const own = `${climbWord(venueClimb) ?? "no climb"} with ${act.anchorVenue.name}'s fans`;
  const abroad = climbWord(controlClimb);
  return `${own} · ${abroad ? `${abroad} with` : "no climb with"} a room in ${act.localLift.control.town} with similar Qloo popularity`;
}

/**
 * A control's line in the Qloo calls list: whose control it is, or why it was skipped, worded as
 * what it is (Daniel, 2026-10-28): a room in the control town with similar Qloo popularity.
 */
export const controlCallLine = ({
  controlFor,
  noFanData,
  town,
}: {
  controlFor?: string;
  noFanData?: string;
  /** The control town. */
  town?: string;
}) => {
  const where = town ? `in ${town} ` : "";
  return noFanData
    ? `Qloo had no fan data for ${noFanData}: the next room ${where}with similar Qloo popularity is read.`
    : controlFor
      ? `The control for ${controlFor}: a room ${where}with similar Qloo popularity.`
      : null;
};

/**
 * The page's line when a failed Qloo call left venues unchecked (Daniel, 2026-10-28): the run
 * tried each call twice, and these venues' acts couldn't be weighed, so the bill may be short.
 */
export function shortLine(venues: readonly string[]): string {
  const names =
    venues.length <= 1
      ? venues.join("")
      : `${venues.slice(0, -1).join(", ")} and ${venues[venues.length - 1]}`;
  return venues.length === 1
    ? `Qloo didn't answer for ${names}, so it wasn't checked: this bill may be short.`
    : `Qloo didn't answer for ${names}, so they weren't checked: this bill may be short.`;
}
