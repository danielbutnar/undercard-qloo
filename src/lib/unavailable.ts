/**
 * Why a booked act can't take its slot, in the buyer's words: a radius clause keeps it off
 * this festival, its routing doesn't reach the town on the date, or the fee doesn't fit.
 */
export const UNAVAILABLE_REASONS = {
  radius: "radius clause",
  routing: "routing",
  fee: "fee",
} as const;

export const UNAVAILABLE_REASON_IDS = ["radius", "routing", "fee"] as const;
export type UnavailableReason = (typeof UNAVAILABLE_REASON_IDS)[number];

/** A replacement on the bill: the act whose slot it took, and why that act dropped out. */
export interface Replacement {
  name: string;
  reason: UnavailableReason | null;
}
