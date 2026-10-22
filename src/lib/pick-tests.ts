import {
  headlinerTagWeights,
  liftsOver,
  sharedTags,
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

/**
 * The artist a pick's name finds on Qloo (docs/evidence.md section 31): the first of a search's
 * top five whose name matches it after section 18's normalising, or null when none does. A
 * pick Qloo doesn't find fails all three tests.
 */
export function foundOnQloo<Artist extends { name: string }>(
  name: string,
  results: readonly Artist[],
): Artist | null {
  return (
    results
      .slice(0, 5)
      .find((entity) => normalise(entity.name) === normalise(name)) ?? null
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
