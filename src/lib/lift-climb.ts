import { z } from "zod";
import { liftsOver, MIN_LIFT, type RankedArtist } from "./assemble-lineup";
import type { FeeBand, FeeBandId } from "./fee-bands";

/**
 * The lift, visible (M9a): a band's list for the headliners alone, then re-sorted by each
 * venue's ranking, with every act the venue lifts past the bar labelled with its real move.
 * Every step is one Qloo call's result; nothing is invented for the motion.
 */
export const CLIMB_SHOWN = 8;

export const ClimbEventSchema = z.object({
  type: z.literal("climb"),
  band: z.enum(["mid", "opener"]),
  /** The venue whose fans were added; null for the headliners-only list. */
  venue: z.object({ entityId: z.string(), name: z.string() }).nullable(),
  acts: z.array(
    z.object({
      entityId: z.string(),
      name: z.string(),
      /** Places gained over the headliners-only list, when the venue lifts it past the bar. */
      move: z.number().int().nullable(),
      /** Not in the headliners-only list at all: new to the top 50 with this venue's fans. */
      fresh: z.boolean().optional(),
    }),
  ),
});

export type ClimbEvent = z.infer<typeof ClimbEventSchema>;

export function climbBaseline(
  band: FeeBandId,
  baseline: readonly Pick<RankedArtist, "entityId" | "name">[],
): ClimbEvent {
  return {
    type: "climb",
    band,
    venue: null,
    acts: baseline
      .slice(0, CLIMB_SHOWN)
      .map(({ entityId, name }) => ({ entityId, name, move: null })),
  };
}

export function climbAfter(
  band: FeeBandId,
  range: Pick<FeeBand, "minPopularity" | "maxPopularity">,
  venue: { entityId: string; name: string },
  baseline: readonly { entityId: string }[],
  run: readonly RankedArtist[],
): ClimbEvent {
  const lifts = liftsOver(baseline, run).slice(0, CLIMB_SHOWN);
  return {
    type: "climb",
    band,
    venue: { entityId: venue.entityId, name: venue.name },
    acts: lifts.map(({ artist, lift, inBaseline }) => ({
      entityId: artist.entityId,
      name: artist.name,
      ...(inBaseline ? {} : { fresh: true }),
      move:
        lift >= MIN_LIFT &&
        artist.popularity >= range.minPopularity &&
        artist.popularity <= range.maxPopularity
          ? lift
          : null,
    })),
  };
}

/** How long each step stays on screen in a replay: a venue's re-sort gets time to read. */
export function playClimbs(
  steps: readonly ClimbEvent[],
): { step: ClimbEvent; holdMs: number }[] {
  return steps.map((step) => ({ step, holdMs: step.venue ? 1800 : 900 }));
}

/** Where a lifted act stood before the venue's fans were added (M9d): "was 50th". */
export function wasPlace(rank: number, move: number): string {
  const place = rank + move;
  const teen = Math.floor((place % 100) / 10) === 1;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][place % 10] ?? "th");
  return `was ${place}${suffix}`;
}
