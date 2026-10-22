import { z } from "zod";
import type { SplitPart } from "@/lib/attribution-line";
import { FEE_BAND_IDS, type FeeBandId } from "@/lib/fee-bands";
import type { SavedBuild } from "./build-store";
import { createQlooClient, QlooCacheMiss } from "./qloo";
import type { QlooCache } from "./qloo-cache";

/** Section 35's call for one fee range of a saved build (docs/evidence.md section 35). */
export interface ExplainCall {
  band: FeeBandId;
  /** The build's headliners, then the range's venues in the order the build ran them. */
  signalEntityIds: string[];
  /** The range's lineup acts, in lineup order. */
  actIds: string[];
  /** The crowd ages the build's artist calls sent; none for builds saved before 2026-10-17. */
  ages: string[];
}

/**
 * The calls Qloo's split of a saved build takes, one per fee range, made exactly as section 35
 * made Boise's: shared by the app's read below and scripts/attribution-warm.ts, so the warm
 * script caches the very keys the app reads. A range with no acts or no venues has no call.
 */
export function explainCalls(build: SavedBuild): ExplainCall[] {
  const headliners = build.context.headliners.map((entry) => entry.entityId);
  return FEE_BAND_IDS.flatMap((band) => {
    const venues = (build.context.anchors[band] ?? []).map(
      (venue) => venue.entityId,
    );
    const actIds = build.lineup.acts
      .filter((act) => act.band === band)
      .map((act) => act.entityId);
    if (!venues.length || !actIds.length) return [];
    return [
      {
        band,
        signalEntityIds: [...headliners, ...venues],
        actIds,
        ages: [...(build.context.ages ?? [])],
      },
    ];
  });
}

/** Each lineup act's split, by the act's entity id; an act without one is left out. */
export type ActSplits = Record<string, SplitPart[]>;

// What the explain call caches (src/lib/qloo/explain.ts), checked again on the way out: a value
// of another shape under the key reads as no split, not as a page error.
const CachedShares = z.array(
  z.object({
    entityId: z.string(),
    shares: z.array(
      z.object({ entityId: z.string(), share: z.number().nonnegative() }),
    ),
  }),
);

/**
 * Qloo's split of each lineup act's result for a saved build (docs/evidence.md section 35), each
 * input named as the build names it. Read through a cache-only client whose fetch throws, as
 * src/server/pick-checks.ts reads its checks, so it never calls Qloo and never writes the cache.
 * A fee range the cache doesn't hold gives its acts no split, never an error; so does an act
 * Qloo gave no split, or a share on an input the call didn't send, which couldn't be named.
 */
export async function attributionFor(
  build: SavedBuild,
  cache: QlooCache,
): Promise<ActSplits> {
  const qloo = createQlooClient({
    apiKey: "",
    cache,
    cacheOnly: true,
    fetch: async () => {
      throw new Error("Qloo's split is read from the Qloo cache only.");
    },
  });
  const splits: ActSplits = {};
  for (const call of explainCalls(build)) {
    let answer;
    try {
      answer = CachedShares.safeParse((await qloo.explain(call)).data);
    } catch (error) {
      if (error instanceof QlooCacheMiss) continue;
      throw error;
    }
    if (!answer.success) continue;
    const inputs = new Map<string, Omit<SplitPart, "share">>([
      ...build.context.headliners.map(
        ({ entityId, name }) =>
          [entityId, { input: "headliner", entityId, name }] as const,
      ),
      ...(build.context.anchors[call.band] ?? []).map(
        ({ entityId, name }) =>
          [entityId, { input: "venue", entityId, name }] as const,
      ),
    ]);
    for (const act of answer.data) {
      if (!call.actIds.includes(act.entityId) || !act.shares.length) continue;
      const parts = act.shares.map(({ entityId, share }) => {
        const input = inputs.get(entityId);
        return input ? { ...input, share } : null;
      });
      if (parts.every((part) => part !== null)) splits[act.entityId] = parts;
    }
  }
  return splits;
}
