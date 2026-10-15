import type { FeeBand } from "./fee-bands";
import type { Act } from "./lineup";

const COLUMNS = [
  "act",
  "band",
  "affinity",
  "popularity",
  "anchor_venue",
  "reason",
] as const;

function cell(value: string): string {
  // A leading =, +, - or @ would make a spreadsheet read the cell as a formula.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** The lineup as CSV (RFC 4180, CRLF line ends), bands in the buyer's order. */
export function lineupCsv(
  acts: readonly Act[],
  bands: readonly FeeBand[],
): string {
  const rows = bands.flatMap((band) =>
    acts
      .filter((act) => act.band === band.id)
      .map((act) => [
        act.name,
        band.label,
        act.affinity.toFixed(2),
        act.popularity.toFixed(2),
        act.anchorVenue.name,
        act.reason,
      ]),
  );
  return (
    [COLUMNS, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
    "\r\n"
  );
}
