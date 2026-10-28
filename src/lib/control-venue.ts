/**
 * The control rule (Daniel's of 24 October): how much of an act's climb is its town's own. A
 * venue's matched control is the music room in the control town whose Qloo popularity is
 * closest to the venue's, ties by name; a room with no fan data (Qloo warns it wasn't scored, or
 * its ranking is the headliners' own) is skipped for the next closest, and with none left there
 * is no control and no local lift. An act's local lift is
 * its place with the control's fans added minus its place with the venue's fans added, a place
 * outside the top 50 counting as 51st.
 *
 * Pure: no I/O. The caller makes the Qloo calls and says which rooms Qloo scored.
 */

/** A music room as Qloo's place insights list it. */
export interface Room {
  entityId: string;
  name: string;
  /** Qloo popularity, 0 to 1; absent or null when Qloo gives none. */
  popularity?: number | null;
}

/** The places a Qloo ranking is read for: its top 50. */
export const RANKED_PLACES = 50;
/** Where an act outside the top 50, or missing from the ranking, counts. */
export const OUTSIDE_PLACE = RANKED_PLACES + 1;

// Two rooms equally far from the venue's popularity tie, whatever floating point makes of it.
const SAME_DISTANCE = 1e-12;

const known = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * The control town's rooms in the order the rule tries them: closest Qloo popularity to the
 * venue's first, ties by name, then by entity id so the order never depends on Qloo's. A room
 * without a popularity is never a candidate. With no popularity for the venue, every room in
 * Qloo's own order.
 */
export function controlCandidates<R extends Room>(
  rooms: readonly R[],
  popularity: number | null,
): R[] {
  if (popularity === null) return [...rooms];
  return rooms
    .flatMap((room) =>
      known(room.popularity)
        ? [{ room, distance: Math.abs(room.popularity - popularity) }]
        : [],
    )
    .sort(
      (a, b) =>
        (Math.abs(a.distance - b.distance) > SAME_DISTANCE
          ? a.distance - b.distance
          : 0) ||
        a.room.name.localeCompare(b.room.name, "en") ||
        (a.room.entityId < b.room.entityId
          ? -1
          : a.room.entityId > b.room.entityId
            ? 1
            : 0),
    )
    .map(({ room }) => room);
}

/**
 * The matched control: the first candidate Qloo scored, asked in order, with the candidates
 * skipped before it. `scored` makes the call for one room and says whether Qloo scored it; no
 * room after the matched one is asked. Null when no candidate is scored.
 */
export async function matchControl<R extends Room>(
  candidates: readonly R[],
  scored: (room: R) => Promise<boolean>,
): Promise<{ control: R | null; skipped: R[] }> {
  const skipped: R[] = [];
  for (const room of candidates) {
    if (await scored(room)) return { control: room, skipped };
    skipped.push(room);
  }
  return { control: null, skipped };
}

type Ranking = readonly (string | { entityId: string })[];

const idOf = (entry: string | { entityId: string }) =>
  typeof entry === "string" ? entry : entry.entityId;

/** Two rankings with the same acts in the same order; an empty one never matches. */
export function sameRanking(a: Ranking, b: Ranking): boolean {
  return (
    a.length > 0 &&
    a.length === b.length &&
    a.every((entry, index) => idOf(entry) === idOf(b[index]))
  );
}

/** Why Qloo used none of an input's fans. */
export type NoFanData = "warning" | "equal ranking";

/**
 * Whether an input's answer shows no fan data: Qloo warned it wasn't scored, or, with no warning,
 * the ranking is the one without the input, entity for entity and in order (the app's own rule,
 * src/lib/fan-data.ts). Null when the input moved the ranking.
 */
export function noFanData({
  warned,
  ranking,
  without,
}: {
  warned: boolean;
  ranking: Ranking;
  without: Ranking;
}): NoFanData | null {
  if (warned) return "warning";
  return sameRanking(ranking, without) ? "equal ranking" : null;
}

/** An act's place in a ranking, from 1; outside the top 50, or missing, it is 51st. */
export function placeIn(ranking: Ranking, actId: string): number {
  const index = ranking.findIndex((entry) => idOf(entry) === actId);
  return index < 0 || index >= RANKED_PLACES ? OUTSIDE_PLACE : index + 1;
}

/** How many places an act climbs when an input's fans join: its place without minus with. */
export function climb(
  actId: string,
  without: Ranking,
  withInput: Ranking,
): number {
  return placeIn(without, actId) - placeIn(withInput, actId);
}

/**
 * An act's local lift: its climb with the venue minus its climb with the matched control,
 * against the same ranking without either, which cancels: its place with the control's fans
 * added minus its place with the venue's. Null without a scored control.
 */
export function localLift(
  actId: string,
  withVenue: Ranking,
  withControl: Ranking | null,
): number | null {
  return withControl === null
    ? null
    : placeIn(withControl, actId) - placeIn(withVenue, actId);
}
