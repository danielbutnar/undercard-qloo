import { QLOO_CALL_CAP } from "./agent-limits";
import { FEE_BAND_IDS, type FeeBand, type FeeBandId } from "./fee-bands";
import {
  formatAffinity,
  formatPopularity,
  formatPopularityRange,
} from "./format";
import type { LocationReading } from "./lineup";
import type { LocalPick } from "./local-pick";

/*
 * Agent 2.0's words (WS13): the lines its new trace data gives the Qloo calls list, Watch and the
 * setlist. WS13 writes them; where they sit on a page is WS12's.
 */

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

/** The trace's last line (WS13.2): why the agent stopped, with the slots still open. */
export function stopLine({
  reason,
  calls,
  cap,
  city,
  open,
}: {
  reason: StopReason;
  calls: number;
  cap: number;
  city: string;
  open: Record<FeeBandId, number>;
}): string {
  switch (reason) {
    case "full":
      return `The agent stopped reading venues: every tier is full, after ${calls} of its ${cap} Qloo calls.`;
    case "rooms":
      return `The agent stopped after trying every music venue Qloo listed in ${city}: ${openWords(open)}.`;
    case "cap":
      return `The agent stopped at its cap of ${cap} Qloo calls: ${openWords(open)}.`;
    case "planner":
      return `The agent stopped before every tier was full: ${openWords(open)}.`;
  }
}

/**
 * Why a run stopped, from what is true, not only what the planner says: every tier full by the
 * rule; else the cap spent; else the planner's word that it tried every music venue; else it
 * stopped early.
 */
export function stopOf({
  open,
  calls,
  cap,
  city,
  claimed,
}: {
  open: Record<FeeBandId, number>;
  calls: number;
  cap: number;
  city: string;
  claimed?: "every_band_full" | "tried_every_music_room";
}): StopLine {
  const reason: StopReason = FEE_BAND_IDS.every((band) => open[band] === 0)
    ? "full"
    : calls >= cap
      ? "cap"
      : claimed === "tried_every_music_room"
        ? "rooms"
        : "planner";
  return { reason, text: stopLine({ reason, calls, cap, city, open }) };
}

/** The card's line for Qloo's location signal (WS13.4): a second reading, never the basis. */
export const locationLine = ({ town, withSignal, without }: LocationReading) =>
  `Second reading, outside the rule: with Qloo's location signal for ${town}, affinity ${formatAffinity(withSignal)} (${formatAffinity(without)} without).`;

/** The local pick's box (WS13.5): its region's name and its title. */
export const LOCAL_PICK_LABEL = "The AI's local pick";
export const LOCAL_PICK_TITLE = "The AI's local pick, for you to check";

/** Under the title: who named the acts, how, and that they take no slot on their own. */
export const localPickIntro = (city: string, count: number) =>
  count === 1
    ? `The AI agent named this act from what it knows of ${city}'s music, then found it on Qloo. Qloo's venue numbers and the rule didn't pick it, and it takes no slot unless you add it.`
    : `The AI agent named these acts from what it knows of ${city}'s music, then found them on Qloo. Qloo's venue numbers and the rule didn't pick them, and each takes no slot unless you add it.`;

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
