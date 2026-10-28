import type { ActSplit, ActSplits, SplitPart } from "./attribution-line";
import { FEE_BAND_IDS, type FeeBandId } from "./fee-bands";
import type { Act } from "./lineup";

/**
 * Credit and split (WS13.10): an act's card credits the venue whose fans, added alone to the
 * headliners', moved it most (its climb); Qloo's split (evidence 35) asks the fee range's venues
 * together and can lean on another one. Evidence 35 counted 44 of the 290 saved cards where the
 * credited venue isn't the largest venue share. Pure: the split comes from the cache.
 */
export interface CreditCheck {
  /** The credited venue's entity id (the act's anchor venue). */
  credited: string;
  /** The venue with Qloo's largest share of the act's match; null when no venue has a share. */
  largest: Pick<SplitPart, "entityId" | "name" | "share"> | null;
  /** True when the credited venue has the largest share (a tie counts); null when unknown. */
  agrees: boolean | null;
}

export function creditAgainstSplit(act: Act, split: ActSplit): CreditCheck {
  const venues = split.parts.filter(
    (part) => part.input === "venue" && part.share > 0,
  );
  const credited = act.anchorVenue.entityId;
  if (!venues.length) return { credited, largest: null, agrees: null };
  const top = Math.max(...venues.map((part) => part.share));
  const leaders = venues.filter((part) => part.share === top);
  const largest =
    leaders.find((part) => part.entityId === credited) ?? leaders[0];
  return {
    credited,
    largest: {
      entityId: largest.entityId,
      name: largest.name,
      share: largest.share,
    },
    agrees: largest.entityId === credited,
  };
}

export interface CreditTally {
  /** Cards on the saved lineups. */
  cards: number;
  /** Of those, the cards with a split that has a venue share. */
  withSplit: number;
  /** Of those, the cards crediting another venue than Qloo's largest venue share. */
  disagree: number;
}

const empty = (): CreditTally => ({ cards: 0, withSplit: 0, disagree: 0 });

/** The count by town and by tier, over saved lineups and their splits. */
export function creditCounts(
  builds: readonly { town: string; acts: readonly Act[]; splits: ActSplits }[],
): {
  total: CreditTally;
  byTown: Record<string, CreditTally>;
  byTier: Record<FeeBandId, CreditTally>;
} {
  const total = empty();
  const byTown: Record<string, CreditTally> = {};
  const byTier = Object.fromEntries(
    FEE_BAND_IDS.map((band) => [band, empty()]),
  ) as Record<FeeBandId, CreditTally>;
  for (const { town, acts, splits } of builds) {
    const own = (byTown[town] ??= empty());
    for (const act of acts) {
      const rows = [total, own, byTier[act.band]];
      for (const row of rows) row.cards++;
      const split = splits[act.entityId];
      const check = split ? creditAgainstSplit(act, split) : null;
      if (!check || check.agrees === null) continue;
      for (const row of rows) row.withSplit++;
      if (!check.agrees) for (const row of rows) row.disagree++;
    }
  }
  return { total, byTown, byTier };
}

/** Draft (a) for Daniel: the credit stays, and one clause says why. */
export const creditClause = (act: Act, largest: Pick<SplitPart, "name">) =>
  `The card credits ${act.anchorVenue.name} because its fans alone moved this act most; with the venues asked together, Qloo traces more of its match to ${largest.name}.`;

/** Draft (b) for Daniel: the credit follows the split, and the climb keeps its venue. */
export const splitCredit = (act: Act, largest: Pick<SplitPart, "name">) =>
  `Credited to ${largest.name}, the venue Qloo's split leans on most; its climb came with ${act.anchorVenue.name}'s fans added.`;
