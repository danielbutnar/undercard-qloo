import { z } from "zod";
import { TraceCallSchema } from "@/lib/build-events";
import { FEE_BAND_IDS } from "@/lib/fee-bands";
import { LineupSchema } from "@/lib/lineup";
import { cacheTtlSeconds, type QlooCache } from "./qloo-cache";

const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});
const VenueSchema = z.object({ entityId: z.string(), name: z.string() });
const perBand = <T extends z.ZodType>(schema: T) =>
  z.object(
    Object.fromEntries(
      FEE_BAND_IDS.map((band) => [band, schema.optional()]),
    ) as Record<(typeof FEE_BAND_IDS)[number], z.ZodOptional<T>>,
  );

/** What a refill needs from the build it changes, kept server-side with the build. */
export const BuildContextSchema = z.object({
  headliners: z.array(
    z.object({
      entityId: z.string(),
      name: z.string(),
      tags: z.array(TagSchema),
    }),
  ),
  comparedTags: z.array(z.object({ name: z.string(), score: z.number() })),
  /** Per band, the headliners-only ranking as entity ids. */
  baselines: perBand(z.array(z.string())),
  /** Per band, the anchor venues the build ran, in the order it ran them. */
  anchors: perBand(z.array(VenueSchema)),
  /** The Qloo age buckets the build's artist calls sent; a refill sends the same. Optional:
   * builds saved before 2026-10-17 sent none. */
  ages: z.array(z.string()).optional(),
});

export const SavedBuildSchema = z.object({
  id: z.string(),
  festivalId: z.string(),
  createdAt: z.string(),
  trace: z.array(TraceCallSchema),
  lineup: LineupSchema,
  context: BuildContextSchema,
  /**
   * The planner's lines, each with how many calls had come back when it was said, so a
   * replay shows its decisions in order. Optional: builds saved before 2026-10-17 have none.
   */
  notes: z
    .array(z.object({ at: z.number().int().nonnegative(), text: z.string() }))
    .optional(),
});

export type BuildContext = z.infer<typeof BuildContextSchema>;
export type SavedBuild = z.infer<typeof SavedBuildSchema>;

const PREFIX = "undercard:build:v1:";

/**
 * Complete builds, kept server-side as long as Qloo responses (through 2026-11-18), so the
 * next visitor gets the board in seconds and refills can reuse the build's context.
 */
export function createBuildStore(
  cache: QlooCache,
  now: () => number = Date.now,
) {
  async function byId(id: string): Promise<SavedBuild | null> {
    const parsed = SavedBuildSchema.safeParse(
      await cache.get(`${PREFIX}id:${id}`),
    );
    return parsed.success ? parsed.data : null;
  }

  return {
    byId,
    async latest(festivalId: string): Promise<SavedBuild | null> {
      const id = await cache.get<string>(`${PREFIX}latest:${festivalId}`);
      return typeof id === "string" ? byId(id) : null;
    },
    async save(build: SavedBuild): Promise<void> {
      const ttl = cacheTtlSeconds(now());
      await cache.set(`${PREFIX}id:${build.id}`, build, ttl);
      await cache.set(`${PREFIX}latest:${build.festivalId}`, build.id, ttl);
    },
  };
}

export type BuildStore = ReturnType<typeof createBuildStore>;

/**
 * A preview deployment shares production's store, so it reads saved builds but never saves
 * one: a fresh run there can't move a festival's latest build.
 */
export function previewSafe(
  store: BuildStore,
  env: Partial<Record<string, string | undefined>> = process.env,
): BuildStore {
  return env.VERCEL_ENV === "preview"
    ? { ...store, save: async () => {} }
    : store;
}
