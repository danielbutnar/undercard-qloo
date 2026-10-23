import { z } from "zod";
import {
  splitLines,
  type ActSplits,
  type SplitPart,
} from "@/lib/attribution-line";
import { FEE_BAND_IDS, type FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { FirstBill } from "@/lib/first-bill";
import type { BuildStore, SavedBuild } from "./build-store";
import { serverBuildStore } from "./deps";
import { createQlooClient, QlooCacheMiss } from "./qloo";
import { createQlooCache, type QlooCache } from "./qloo-cache";

export type { ActSplits } from "@/lib/attribution-line";

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
    // The range's venues in Qloo's split: those it scored for any of the range's acts. A venue
    // the call sent but Qloo scored for none (section 35 found one, listed as not found) isn't.
    const acts = answer.data.filter((act) =>
      call.actIds.includes(act.entityId),
    );
    const scored = new Set(
      acts.flatMap((act) => act.shares.map((share) => share.entityId)),
    );
    const venues = (build.context.anchors[call.band] ?? []).filter((venue) =>
      scored.has(venue.entityId),
    ).length;
    for (const act of acts) {
      if (!act.shares.length) continue;
      const parts = act.shares.map(({ entityId, share }) => {
        const input = inputs.get(entityId);
        return input ? { ...input, share } : null;
      });
      if (parts.every((part) => part !== null))
        splits[act.entityId] = { venues, parts };
    }
  }
  return splits;
}

/**
 * The first bill with each saved lineup act's card line on Qloo's split (WS7 part b), worked out
 * on the server from the saved build and the Qloo cache only, as withVenueSwitch and withFanData
 * are: never a Qloo call. In synthetic mode the cache is the seeded one. The bill is left as it
 * was when no act has a line, the build isn't stored or is another festival's, or a read fails.
 */
export async function withSplits(
  bill: FirstBill | null,
  festival: Festival,
  {
    store = serverBuildStore(),
    cache = createQlooCache(),
  }: { store?: Pick<BuildStore, "byId">; cache?: QlooCache } = {},
): Promise<FirstBill | null> {
  if (!bill) return bill;
  try {
    const saved = await store.byId(bill.build.id);
    if (!saved || saved.festivalId !== festival.id) return bill;
    const splits = splitLines(await attributionFor(saved, cache));
    return Object.keys(splits).length > 0 ? { ...bill, splits } : bill;
  } catch {
    return bill;
  }
}
