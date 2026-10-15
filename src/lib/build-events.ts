import { z } from "zod";
import { LineupSchema } from "./lineup";

/** One Qloo call as the trace panel shows it. Entity ids in params are replaced by names. */
export const TraceCallSchema = z.object({
  n: z.number().int().positive(),
  tool: z.string(),
  endpoint: z.string(),
  summary: z.string(),
  params: z.array(z.object({ key: z.string(), value: z.string() })),
  resultCount: z.number().int().nonnegative().nullable(),
  ms: z.number().nonnegative(),
  cached: z.boolean(),
  error: z.string().optional(),
});

/** The events POST /api/undercard streams, one JSON object per line. */
export const BuildEventSchema = z.discriminatedUnion("type", [
  /** First event of a build: its id (refills name it) and whether it replays a saved build. */
  z.object({
    type: z.literal("build"),
    id: z.string(),
    createdAt: z.string(),
    replayed: z.boolean(),
  }),
  z.object({ type: z.literal("call"), call: TraceCallSchema }),
  z.object({ type: z.literal("status"), text: z.string() }),
  z.object({ type: z.literal("lineup"), lineup: LineupSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({
    type: z.literal("done"),
    calls: z.number().int().nonnegative(),
    ms: z.number().nonnegative(),
  }),
]);

export type TraceCall = z.infer<typeof TraceCallSchema>;
export type BuildEvent = z.infer<typeof BuildEventSchema>;
