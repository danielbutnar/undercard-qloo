import {
  creditAgainstSplit,
  creditCounts,
  type CreditCheck,
} from "@/lib/credit-split";
import type { FeeBandId } from "@/lib/fee-bands";
import { attributionFor } from "./attribution";
import type { SavedBuild } from "./build-store";
import type { QlooCache } from "./qloo-cache";

/** A card whose credited venue isn't Qloo's largest venue share: names, for .design/ only. */
export interface CreditCard {
  festivalId: string;
  band: FeeBandId;
  act: string;
  credited: string;
  largest: NonNullable<CreditCheck["largest"]>;
}

/**
 * Credit against split over saved builds (WS13.10), from the Qloo cache only, as the act cards'
 * split lines are read (src/server/attribution.ts): never a Qloo call, never a write. The counts
 * by town and tier, and the cards that credit another venue than Qloo's largest venue share.
 */
export async function creditReport(
  builds: readonly SavedBuild[],
  cache: QlooCache,
  townOf: (festivalId: string) => string = (id) => id,
) {
  const rows = [];
  const cards: CreditCard[] = [];
  for (const build of builds) {
    const splits = await attributionFor(build, cache);
    rows.push({
      town: townOf(build.festivalId),
      acts: build.lineup.acts,
      splits,
    });
    for (const act of build.lineup.acts) {
      const split = splits[act.entityId];
      const check = split ? creditAgainstSplit(act, split) : null;
      if (check?.agrees === false && check.largest)
        cards.push({
          festivalId: build.festivalId,
          band: act.band,
          act: act.name,
          credited: act.anchorVenue.name,
          largest: check.largest,
        });
    }
  }
  return { counts: creditCounts(rows), cards };
}
