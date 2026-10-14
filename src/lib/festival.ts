import type { FeeBand } from "./fee-bands";

export interface PresaleDay {
  /** ISO date, yyyy-mm-dd. */
  date: string;
  /** Tickets sold that day. */
  sold: number;
}

export interface Festival {
  id: string;
  name: string;
  city: string;
  region: string;
  capacity: number;
  crowdAge: { min: number; max: number };
  /** Booked headliners, stored as names only; the agent resolves them through Qloo /search. */
  headliners: readonly [string, string];
  feeBands: readonly FeeBand[];
  presale: readonly PresaleDay[];
}

export function ticketsSold(presale: readonly PresaleDay[]): number {
  return presale.reduce((total, day) => total + day.sold, 0);
}
