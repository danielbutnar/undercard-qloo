import { z } from "zod";
import {
  headlinerTagWeights,
  sharedTags,
  type AssemblyInput,
  type RankedArtist,
} from "./assemble-lineup";
import { FEE_BAND_IDS, feeBandFor } from "./fee-bands";
import { TagSchema } from "./lineup";

/**
 * The AI's local pick (WS13.5): an act from the festival's town that the planner named from its
 * own knowledge, found on Qloo by search, with Qloo's numbers. It is for the buyer to check and
 * never takes a slot on its own: only the buyer adds it to the bill.
 */
export const LocalPickSchema = z.object({
  entityId: z.string().min(1),
  /** As Qloo names it. */
  name: z.string().min(1),
  /** As the AI named it. */
  asked: z.string().min(1),
  /** The AI's one line on why, in its own words. */
  why: z.string(),
  /** Qloo popularity, 0 to 1. */
  popularity: z.number().min(0).max(1),
  /** The tier its popularity falls in; null when it sits above or below every tier. */
  band: z.enum(FEE_BAND_IDS).nullable(),
  range: z.enum(["in", "above", "below"]),
  /** Genres it shares with the headliners, strongest first; none is possible here. */
  sharedTags: z.array(TagSchema),
});

export type LocalPick = z.infer<typeof LocalPickSchema>;

/** Qloo's numbers for an act the AI named, read the way the rule reads an act's. */
export function localPickOf(
  input: Pick<AssemblyInput, "bands" | "headliners" | "comparedTags">,
  found: RankedArtist,
  asked: string,
  why: string,
): LocalPick {
  const band = feeBandFor(found.popularity, input.bands);
  const top = Math.max(...input.bands.map((entry) => entry.maxPopularity));
  return {
    entityId: found.entityId,
    name: found.name,
    asked,
    why,
    popularity: found.popularity,
    band: band?.id ?? null,
    range: band ? "in" : found.popularity > top ? "above" : "below",
    sharedTags: sharedTags(
      found,
      headlinerTagWeights({ ...input, baselines: {}, venueRuns: [] }),
    ),
  };
}
