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

/**
 * The card's line where another venue's share is strictly larger (Daniel's choice of 2026-10-28,
 * his words): the credit stands, and the line says why. An exact tie gets none.
 */
export const creditLine = (act: Act, largest: Pick<SplitPart, "name">) =>
  `Credited to ${act.anchorVenue.name}: its fans alone lifted this act onto the bill. Asked about all the venues together, Qloo traces more of the match to ${largest.name}.`;

/** The credit line for each act whose credited venue has a strictly smaller share, by id. */
export function creditLines(
  acts: readonly Act[],
  splits: ActSplits,
): Record<string, string> {
  const lines: Record<string, string> = {};
  for (const act of acts) {
    const split = splits[act.entityId];
    const check = split ? creditAgainstSplit(act, split) : null;
    if (check?.agrees === false && check.largest)
      lines[act.entityId] = creditLine(act, check.largest);
  }
  return lines;
}
