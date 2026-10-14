import type { FeeBand } from "./fee-bands";

const counts = new Intl.NumberFormat("en-US");
const shortDates = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatCount(value: number): string {
  return counts.format(value);
}

export function formatAffinity(affinity: number): string {
  return affinity.toFixed(2);
}

function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  const suffix = ["th", "st", "nd", "rd"][value % 10] ?? "th";
  return `${value}${suffix}`;
}

// Rounds down (with a tolerance for float error, so 0.57 stays 57) to keep a value just under
// a band edge on the lower band's side.
function percentile(popularity: number): number {
  return Math.floor(popularity * 100 + 1e-9);
}

/** A Qloo popularity percentile (0 to 1) as an ordinal, such as "91st". */
export function formatPercentile(popularity: number): string {
  return ordinal(percentile(popularity));
}

export function formatBandRange(band: FeeBand): string {
  return `${formatPercentile(band.minPopularity)}–${formatPercentile(band.maxPopularity)}`;
}

/** An ISO date (yyyy-mm-dd) as "Sep 16". */
export function formatShortDate(isoDate: string): string {
  return shortDates.format(new Date(`${isoDate}T00:00:00Z`));
}
