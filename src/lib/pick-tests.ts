import {
  headlinerTagWeights,
  liftsOver,
  sharedTags,
  sharedWeight,
  type ArtistTag,
  type AssemblyInput,
  type RankedArtist,
} from "./assemble-lineup";
import { feeBandFor } from "./fee-bands";

/** Section 18's normalising: accents, case, a bracketed note and a leading "The" dropped. */
export const normalise = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\([^)]*\)/g, "")
    .toLowerCase()
    .replace(/^\s*the\s+/, "")
    .replace(/[^\p{L}\p{N}]/gu, "");

// Letters NFKD leaves whole, folded to the ASCII a search would match (WS8).
const LETTERS: Record<string, string> = {
  ı: "i",
  İ: "I",
  ł: "l",
  Ł: "L",
  ø: "o",
  Ø: "O",
  đ: "d",
  Đ: "D",
  ð: "d",
  Ð: "D",
  þ: "th",
  Þ: "Th",
  ß: "ss",
  æ: "ae",
  Æ: "Ae",
  œ: "oe",
  Œ: "Oe",
};

/** A name with its accents folded: "Altın Gün" is "Altin Gun" (WS8). */
export const foldAccents = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[ıİłŁøØđĐðÐþÞßæÆœŒ]/g, (letter) => LETTERS[letter] ?? letter);

/** Whether a name has a letter beyond ASCII, which Qloo's search can miss (WS8). */
export const hasNonAscii = (name: string) => /[^\x00-\x7F]/.test(name);

/**
 * A name as the app compares it (Daniel, 2026-10-29): the app's full fold, foldAccents then
 * section 18's normalising, so "Fjord" and "Fjørd" are one name. A name with no letter or digit
 * left is compared as typed, in lower case.
 */
export const nameKey = (name: string) =>
  normalise(foldAccents(name)) || name.trim().toLowerCase();

/** Whether two names are one act's name, both folded (nameKey). */
export const sameName = (a: string, b: string) => nameKey(a) === nameKey(b);

/**
 * The artist a pick's name finds on Qloo (docs/evidence.md section 31): the first of a search's
 * top five whose name matches it, both folded, or null when none does. A pick Qloo doesn't find
 * fails all three tests.
 */
export function foundOnQloo<
  Artist extends { name: string; tags?: readonly ArtistTag[] },
>(
  name: string,
  results: readonly Artist[],
  /**
   * The headliners' genre weights (headlinerTagWeights). When several of the top five carry the
   * name, the one whose genres the headliners share most is taken, ties in Qloo's order (WS13.6);
   * without them, the first.
   */
  weights?: ReadonlyMap<string, number>,
  /**
   * How both names are compared: the app's full fold, or section 18's normalising alone where
   * the evidence counts as section 31 counted (evidence:check, scripts/with-without-qloo.ts).
   */
  key: (name: string) => string = nameKey,
): Artist | null {
  const matches = results
    .slice(0, 5)
    .filter((entity) => key(entity.name) === key(name));
  if (matches.length < 2 || !weights) return matches[0] ?? null;
  return matches.reduce((best, entity) =>
    sharedWeight(entity, weights) > sharedWeight(best, weights) ? entity : best,
  );
}

/**
 * The three tests every act on a Qloo lineup passes, read for any artist the way the booking
 * rule reads them (docs/evidence.md section 31): its Qloo popularity inside one of the bands,
 * the genre tags it shares with the headliners, and its best climb in a venue's list over the
 * headliners-only list of the same band (null when no venue's list holds it). Any climb
 * counts here; the rule itself books only at MIN_LIFT or more. `range` says where the
 * popularity sits: the bands meet edge to edge, so outside them it's above or below them all.
 */
export function pickTests(input: AssemblyInput, artist: RankedArtist) {
  const inFeeRange = feeBandFor(artist.popularity, input.bands) !== null;
  const top = Math.max(...input.bands.map((band) => band.maxPopularity));
  const range: "in" | "above" | "below" = inFeeRange
    ? "in"
    : artist.popularity > top
      ? "above"
      : "below";
  const genres = sharedTags(artist, headlinerTagWeights(input)).length;
  let climb: number | null = null;
  for (const run of input.venueRuns) {
    const lift = liftsOver(input.baselines[run.band] ?? [], run.artists).find(
      (entry) => entry.artist.entityId === artist.entityId,
    );
    if (lift && (climb === null || lift.lift > climb)) climb = lift.lift;
  }
  return {
    inFeeRange,
    range,
    genres,
    climb,
    passes: inFeeRange && genres >= 2 && climb !== null && climb > 0,
  };
}
