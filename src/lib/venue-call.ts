/**
 * Which venue a Qloo call's line names (WS8). A venue's call says "…artists for the headliners
 * and <venue>", then perhaps a note in brackets or a refill's ", minus the board". The call
 * records the venue's name, not its entity id, so a venue matches only where its whole name
 * ends there: "Venue 330" never matches "Venue 331"'s call.
 */
const MARK = "headliners and ";

/** Whether the call's line names this venue, by its whole name. */
export function namesVenue(summary: string, name: string): boolean {
  const at = summary.indexOf(MARK + name);
  if (at < 0) return false;
  const next = summary.slice(at + MARK.length + name.length);
  return next === "" || next.startsWith(" (") || next.startsWith(",");
}

/** The venue the call's line names: of those it names by their whole names, the longest. */
export function venueOfCall<V extends { name: string }>(
  summary: string,
  venues: readonly V[],
): V | undefined {
  return venues
    .filter((venue) => namesVenue(summary, venue.name))
    .reduce<V | undefined>(
      (best, venue) =>
        !best || venue.name.length > best.name.length ? venue : best,
      undefined,
    );
}

/** What the line says after the venue's whole name: its note, if any. */
export function afterVenue(summary: string, name: string): string {
  const at = summary.indexOf(MARK + name);
  return at < 0 ? "" : summary.slice(at + MARK.length + name.length);
}
