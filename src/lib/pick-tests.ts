import {
  headlinerTagWeights,
  liftsOver,
  sharedTags,
  type AssemblyInput,
  type RankedArtist,
} from "./assemble-lineup";
import { feeBandFor } from "./fee-bands";

/**
 * The three tests every act on a Qloo lineup passes, read for any artist the way the booking
 * rule reads them (docs/evidence.md section 31): its Qloo popularity inside one of the bands,
 * the genre tags it shares with the headliners, and its best climb in a venue's list over the
 * headliners-only list of the same band (null when no venue's list holds it). Any climb
 * counts here; the rule itself books only at MIN_LIFT or more.
 */
export function pickTests(input: AssemblyInput, artist: RankedArtist) {
  const inFeeRange = feeBandFor(artist.popularity, input.bands) !== null;
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
    genres,
    climb,
    passes: inFeeRange && genres >= 2 && climb !== null && climb > 0,
  };
}
