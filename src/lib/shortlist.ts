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
