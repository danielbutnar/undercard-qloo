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
  /**
   * 2 for a build Agent 2.0 made (WS13): its venue reads keep Qloo's warnings (the scored read),
   * so its replay and venue switch read them back that way. Absent on 1.0 builds.
   */
  engine: z.literal(2).optional(),
  /**
   * The Qloo cache prefix the build's answers sit under, which its replay and venue switch read
   * (WS13, Daniel 2026-10-24). Absent on 1.0 builds, which read src/lib/qloo's QLOO_CACHE_PREFIX.
   */
  cachePrefix: z.string().optional(),
});

export type BuildContext = z.infer<typeof BuildContextSchema>;
export type SavedBuild = z.infer<typeof SavedBuildSchema>;

const PREFIX = "undercard:build:v1:";

/**
 * Complete builds, kept server-side as long as Qloo responses (through 2026-11-18), so a visitor
 * gets the board in seconds and refills can reuse the build's context. A festival's first
 * complete build stays its latest, the one every visitor opens on; a later live run is kept under
 * its own id only, for whoever ran it.
 */
export function createBuildStore(
  cache: QlooCache,
  now: () => number = Date.now,
  {
    /** How long save() waits to learn whether the festival already has a saved build. */
    latestReadTimeoutMs = 2000,
  }: { latestReadTimeoutMs?: number } = {},
) {
  async function byId(id: string): Promise<SavedBuild | null> {
    const parsed = SavedBuildSchema.safeParse(
      await cache.get(`${PREFIX}id:${id}`),
    );
    return parsed.success ? parsed.data : null;
  }

  async function latest(festivalId: string): Promise<SavedBuild | null> {
    const id = await cache.get<string>(`${PREFIX}latest:${festivalId}`);
    return typeof id === "string" ? byId(id) : null;
  }

  // Fails closed: true only when a read that finished cleanly, in time, found no saved build for
  // the festival (no pointer, or one to a build no longer stored). A read that fails or times
  // out, or a stored build that doesn't parse, counts as one there.
  async function noneSaved(festivalId: string): Promise<boolean> {
    const read = <T>(key: string) =>
      cache.getOrThrow ? cache.getOrThrow<T>(key) : cache.get<T>(key);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), latestReadTimeoutMs);
    });
    const check = async () => {
      const id = await read<unknown>(`${PREFIX}latest:${festivalId}`);
      if (id === null) return true;
      return (
        typeof id === "string" && (await read(`${PREFIX}id:${id}`)) === null
      );
    };
    try {
      return await Promise.race([check(), late]);
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    byId,
    latest,
    async save(build: SavedBuild): Promise<void> {
      const ttl = cacheTtlSeconds(now());
      await cache.set(`${PREFIX}id:${build.id}`, build, ttl);
      if (await noneSaved(build.festivalId))
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
