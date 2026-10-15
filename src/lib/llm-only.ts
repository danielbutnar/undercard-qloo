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

export type LlmOnlyPick = z.infer<typeof LlmOnlyPickSchema>;
export type LlmOnlyLineup = z.infer<typeof LlmOnlyLineupSchema>;
