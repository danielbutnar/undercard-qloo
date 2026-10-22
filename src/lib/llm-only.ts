import { z } from "zod";

/** One act the model suggests on its own: a name and its reason, no Qloo data. */
export const LlmOnlyPickSchema = z.object({
  name: z.string().min(1),
  note: z.string(),
});

/** The LLM-only baseline: the same brief, answered by the model without Qloo. */
export const LlmOnlyLineupSchema = z.object({
  festivalId: z.string(),
  createdAt: z.string(),
  picks: z.array(LlmOnlyPickSchema).max(10),
});

/**
 * One pick on Qloo, for its Without Qloo card (docs/evidence.md section 31): not checked when
 * the Qloo cache doesn't hold its search or the build's lists; not found when search's top five
 * don't match it; otherwise its popularity against the fee range, the genres it shares with the
 * headliners and its best climb in one of the build's venue lists (null when none holds it).
 */
export const PickCheckSchema = z.discriminatedUnion("status", [
  z.object({ name: z.string(), status: z.literal("not-checked") }),
  z.object({ name: z.string(), status: z.literal("not-found") }),
  z.object({
    name: z.string(),
    status: z.literal("found"),
    popularity: z.number(),
    range: z.enum(["in", "above", "below"]),
    genres: z.number(),
    climb: z.number().nullable(),
  }),
]);

export type LlmOnlyPick = z.infer<typeof LlmOnlyPickSchema>;
export type LlmOnlyLineup = z.infer<typeof LlmOnlyLineupSchema>;
export type PickCheck = z.infer<typeof PickCheckSchema>;
