import { normalise } from "./pick-tests";

/**
 * The buyer's shortlist (WS4): a buyer picks one of the checked towns and pastes the acts
 * they've been pitched; Undercard sorts them by how they climb with that town's venue fans and
 * shows each one's fee range and genre fit. It drafts nothing and books nothing.
 */

/** At most this many act names in one check. */
export const SHORTLIST_MAX_NAMES = 10;

/**
 * The most Qloo calls one check may make: a search per name (10), one ranking for the
 * headliners alone and one per anchor venue (every saved build reads at most 3).
 */
export const SHORTLIST_CALL_CAP = 14;

/** The names a buyer pasted: one per line, trimmed, with empty lines dropped. */
export function pastedNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** A name checked once: typed twice, or naming the same act on Qloo as one before it. */
export interface Repeat {
  name: string;
  sameAs: string;
}

/** An act in one Qloo answer: its id and Qloo's score (query.affinity) in that answer. */
export interface Scored {
  entityId: string;
  affinity: number | null;
}

/**
 * Places within one Qloo answer, 1 for the highest score. Qloo normalises scores per query,
 * so a place compares only with places in the same answer. An act without a score has none;
 * equal scores keep Qloo's order.
 */
export function placesIn(answer: readonly Scored[]): Map<string, number> {
  const scored = answer.filter(
    (act): act is Scored & { affinity: number } => act.affinity !== null,
  );
  const ranked = scored
    .map((act, order) => ({ act, order }))
    .sort((a, b) => b.act.affinity - a.act.affinity || a.order - b.order);
  return new Map(ranked.map(({ act }, index) => [act.entityId, index + 1]));
}

/**
 * The same answer: the same acts in the same order with the same scores. A venue Qloo has no
 * fan data for leaves the headliners' answer exactly as it was (docs/evidence.md section 35;
 * in the 29 saved builds, every venue run with the headliners' ranking also had their scores).
 */
export function sameAnswer(
  a: readonly Scored[],
  b: readonly Scored[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (act, index) =>
        act.entityId === b[index].entityId &&
        act.affinity === b[index].affinity,
    )
  );
}

/** One venue's answer, as places. */
export interface VenuePlaces {
  venueId: string;
  places: ReadonlyMap<string, number>;
}

/** An act's places and climb: null where Qloo gave it no place to compare. */
export interface Climb {
  /** Its place for the headliners' fans alone. */
  alone: number | null;
  /** Its best place with one venue's fans added, and that venue (the first read, on a tie). */
  best: { venueId: string; place: number } | null;
  /** Places alone minus the best place: above 0, a venue's fans lift it. */
  climb: number | null;
}

/**
 * Step 2's arithmetic (WS4): an act's climb is its place with the headliners alone minus its
 * best place with one venue's fans added, every place read within its own call.
 */
export function climbOf(
  entityId: string,
  alone: ReadonlyMap<string, number>,
  venues: readonly VenuePlaces[],
): Climb {
  let best: Climb["best"] = null;
  for (const { venueId, places } of venues) {
    const place = places.get(entityId);
    if (place !== undefined && (best === null || place < best.place))
      best = { venueId, place };
  }
  const place = alone.get(entityId) ?? null;
  return {
    alone: place,
    best,
    climb: place !== null && best !== null ? place - best.place : null,
  };
}

/**
 * The names to search, each once: a repeat after section 18's normalising (accents, case, a
 * bracketed note, a leading "The") keeps the first spelling.
 */
export function distinctNames(names: readonly string[]): {
  names: string[];
  repeats: Repeat[];
} {
  const first = new Map<string, string>();
  const repeats: Repeat[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (name === "") continue;
    const key = normalise(name) || name.toLowerCase();
    const seen = first.get(key);
    if (seen !== undefined) repeats.push({ name, sameAs: seen });
    else first.set(key, name);
  }
  return { names: [...first.values()], repeats };
}
