import type { Act } from "./lineup";

/** How many venue colours the theme defines (--color-venue-0 to --color-venue-5). */
export const VENUE_HUES = 6;

/**
 * Each venue's colour on the chart, as an index into the theme's venue colours: the venue
 * whose fans lifted most acts first, ties in the order the agent read the venues, and any venue
 * an act names that the list leaves out after them. Worked out once from the saved lineup, so a
 * venue keeps its colour while the buyer switches venues off and on.
 */
export function venueHues(
  venues: readonly { entityId: string }[],
  acts: readonly Pick<Act, "anchorVenue">[],
): Map<string, number> {
  const lifted = new Map<string, number>();
  for (const act of acts)
    lifted.set(
      act.anchorVenue.entityId,
      (lifted.get(act.anchorVenue.entityId) ?? 0) + 1,
    );
  const order = [
    ...new Set([
      ...venues.map((venue) => venue.entityId),
      ...acts.map((act) => act.anchorVenue.entityId),
    ]),
  ];
  const ranked = order
    .map((id, index) => ({ id, index, count: lifted.get(id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index);
  return new Map(ranked.map(({ id }, rank) => [id, rank % VENUE_HUES]));
}
