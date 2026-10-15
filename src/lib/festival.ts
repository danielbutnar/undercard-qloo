import { z } from "zod";
import { FEE_BAND_IDS, type FeeBand } from "./fee-bands";

export interface PresaleDay {
  /** ISO date, yyyy-mm-dd. */
  date: string;
  /** Tickets sold that day. */
  sold: number;
}

export interface Festival {
  id: string;
  name: string;
  city: string;
  region: string;
  capacity: number;
  crowdAge: { min: number; max: number };
  /** Booked headliners, stored as names only; the agent resolves them through Qloo /search. */
  headliners: readonly [string, string];
  feeBands: readonly FeeBand[];
  presale: readonly PresaleDay[];
}

/** Checks the seed file (seed/sagebrush-sound.json) as the app loads it. */
export const FestivalSchema: z.ZodType<Festival> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  city: z.string().min(1),
  region: z.string().min(1),
  capacity: z.number().int().positive(),
  crowdAge: z.object({ min: z.number().int(), max: z.number().int() }),
  headliners: z.tuple([z.string().min(1), z.string().min(1)]),
  feeBands: z.array(
    z.object({
      id: z.enum(FEE_BAND_IDS),
      label: z.string().min(1),
      minPopularity: z.number().min(0).max(1),
      maxPopularity: z.number().min(0).max(1),
      slots: z.number().int().positive(),
    }),
  ),
  presale: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      sold: z.number().int().nonnegative(),
    }),
  ),
});

export function ticketsSold(presale: readonly PresaleDay[]): number {
  return presale.reduce((total, day) => total + day.sold, 0);
}
