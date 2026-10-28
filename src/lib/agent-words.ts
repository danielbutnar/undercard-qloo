import { FEE_BAND_IDS, type FeeBandId } from "./fee-bands";
import { formatAffinity } from "./format";
import type { LocationReading } from "./lineup";

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
      return `The agent stopped after trying every music room Qloo listed in ${city}: ${openWords(open)}.`;
    case "cap":
      return `The agent stopped at its cap of ${cap} Qloo calls: ${openWords(open)}.`;
    case "planner":
      return `The agent stopped before every tier was full: ${openWords(open)}.`;
  }
}

/**
 * Why a run stopped, from what is true, not only what the planner says: every tier full by the
 * rule; else the cap spent; else the planner's word that it tried every music room; else it
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
