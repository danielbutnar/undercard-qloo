import { LOCAL_PICK_ADDED } from "./agent-words";
import type { FeeBand } from "./fee-bands";
import type { Act } from "./lineup";
import type { LocalPick } from "./local-pick";
import { UNAVAILABLE_REASONS, type Replacement } from "./unavailable";

const COLUMNS = [
  "act",
  "band",
  "affinity",
  "popularity",
  "anchor_venue",
  "reason",
  "replaces",
  "unavailable_reason",
] as const;

function cell(value: string): string {
  // A leading =, +, - or @ would make a spreadsheet read the cell as a formula.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * The lineup as CSV (RFC 4180, CRLF line ends), bands in the buyer's order. A replacement's
 * row names the act whose slot it took and why that act dropped out. The AI's local picks the
 * buyer added (WS13.5) follow, each marked as the buyer's own addition.
 */
export function lineupCsv(
  acts: readonly Act[],
  bands: readonly FeeBand[],
  replaced: Readonly<Record<string, Replacement>> = {},
  added: readonly LocalPick[] = [],
  /** A line, one cell, above the header: a demo festival's says it's fictional (WS12 item 7). */
  { note }: { note?: string | null } = {},
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
        replaced[act.entityId]?.name ?? "",
        replaced[act.entityId]?.reason
          ? UNAVAILABLE_REASONS[replaced[act.entityId].reason!]
          : "",
      ]),
  );
  const additions = added.map((pick) => [
    pick.name,
    bands.find((band) => band.id === pick.band)?.label ?? "",
    "",
    pick.popularity.toFixed(2),
    "",
    LOCAL_PICK_ADDED,
    "",
    "",
  ]);
  return (
    [...(note ? [[note]] : []), COLUMNS, ...rows, ...additions]
      .map((row) => row.map(cell).join(","))
      .join("\r\n") + "\r\n"
  );
}
