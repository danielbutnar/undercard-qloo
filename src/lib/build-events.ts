import { STOP_REASONS } from "./agent-words";
import { ClimbEventSchema } from "./lift-climb";
import { RunningSlotSchema } from "./running-order";
import { z } from "zod";
import { ActSchema, LineupSchema } from "./lineup";
import { LocalPickSchema } from "./local-pick";

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
  /** Busy answers (429, 5xx) the call was retried after; a retry isn't a new call. */
  retried: z.array(z.number().int()).optional(),
  error: z.string().optional(),
  /**
   * The venue this call read, when Qloo had no fan data for it (WS13.1): Qloo's not_found warning
   * named it, or its ranking was the headliners' own, score for score. Absent on 1.0 builds.
   */
  noFanData: z.string().optional(),
  /** The planner's own line on why it made this call (WS13.7): a venue read's reason. */
  why: z.string().optional(),
  /** On a control's read (WS13.3): the town venue it is the matched venue abroad for. */
  controlFor: z.string().optional(),
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
  /** A status line; planner: true marks the planning model's own words, saved with the build. */
  z.object({
    type: z.literal("status"),
    text: z.string(),
    planner: z.boolean().optional(),
  }),
  z.object({ type: z.literal("lineup"), lineup: LineupSchema }),
  /** A refill's result: the act that takes the unavailable act's slot. */
  z.object({ type: z.literal("refill"), replaces: z.string(), act: ActSchema }),
  /** One step of the lift, visible (M9a): a band's list after one Qloo call. */
  ClimbEventSchema,
  /** A running order (M8a): two stages, the acts on at the same time sharing the least. */
  z.object({ type: z.literal("running-order"), slots: z.array(RunningSlotSchema) }),
  /** A redraft's result (M8c): each slot not kept, with the act that now takes it. */
  z.object({
    type: z.literal("redraft"),
    pairs: z.array(z.object({ replaces: z.string(), act: ActSchema })),
  }),
  /** An error; code, when set, names a state the page designs for (M6f). */
  z.object({
    type: z.literal("error"),
    message: z.string(),
    code: z
      .enum([
        "limit",
        "qloo-busy",
        // The planner's model call failed or refused: the run ends as a busy Qloo ends it.
        "planner-failed",
        "headliner-not-found",
        "town-not-found",
        "too-few-rooms",
        "not-full",
        "no-saved-build",
      ])
      .optional(),
  }),
  z.object({
    type: z.literal("done"),
    calls: z.number().int().nonnegative(),
    ms: z.number().nonnegative(),
  }),
  /** The AI's local picks Qloo found (WS13.5), after the lineup: for the buyer to check. */
  z.object({ type: z.literal("local-pick"), picks: z.array(LocalPickSchema) }),
  /** Why the agent stopped reading venues (WS13.2): the trace's last line, before the lineup. */
  z.object({
    type: z.literal("stopped"),
    reason: z.enum(STOP_REASONS),
    text: z.string(),
  }),
]);

export type TraceCall = z.infer<typeof TraceCallSchema>;
export type BuildEvent = z.infer<typeof BuildEventSchema>;
