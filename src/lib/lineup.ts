import { z } from "zod";
import { FEE_BAND_IDS, type FeeBandId } from "./fee-bands";

/** A Qloo tag the act shares with the headliners, such as urn:tag:genre:music:dream_pop. */
export const TagSchema = z.object({
  id: z.string().startsWith("urn:tag:"),
  name: z.string().min(1),
});

/** A Boise music venue whose fans the act shares; local taste comes from these anchors. */
export const VenueSchema = z.object({
  entityId: z.string().min(1),
  name: z.string().min(1),
});

export const ActSchema = z.object({
  entityId: z.string().min(1),
  name: z.string().min(1),
  band: z.enum(FEE_BAND_IDS),
  /** Qloo affinity to the headliners and the anchor venue, 0 to 1. */
  affinity: z.number().min(0).max(1),
  /** Qloo popularity percentile, 0 to 1; it decides the fee band. */
  popularity: z.number().min(0).max(1),
  anchorVenue: VenueSchema,
  /** The "Why Boise" line; it names the anchor venue. */
  reason: z.string().min(1),
  sharedTags: z.tuple([TagSchema, TagSchema]),
});

export const LineupSchema = z.object({
  festivalId: z.string().min(1),
  acts: z.array(ActSchema),
});

export type Tag = z.infer<typeof TagSchema>;
export type Venue = z.infer<typeof VenueSchema>;
export type Act = z.infer<typeof ActSchema>;
export type Lineup = z.infer<typeof LineupSchema>;

/** A band's acts, strongest affinity first. */
export function actsInBand(acts: readonly Act[], band: FeeBandId): Act[] {
  return acts
    .filter((act) => act.band === band)
    .sort((a, b) => b.affinity - a.affinity);
}
