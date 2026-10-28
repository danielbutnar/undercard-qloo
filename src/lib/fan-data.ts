import type { AssemblyInput } from "./assemble-lineup";

/**
 * Whether a venue's ranking is the headliners' own, act for act and score for score (WS13.1):
 * Qloo then used none of the venue's fans. Section 35 found the saved builds' runs with the
 * headliners' own ranking to be exactly the venues Qloo left out of its split, 29 of 29 (the
 * not_found warning itself was seen for one of them); an order alone isn't enough, since a short
 * list can keep its order with fan data. An empty ranking never counts.
 */
export function rankingUnchanged(
  baseline: readonly { entityId: string; affinity: number | null }[],
  run: readonly { entityId: string; affinity: number | null }[],
): boolean {
  return (
    baseline.length > 0 &&
    baseline.length === run.length &&
    baseline.every(
      (artist, index) =>
        artist.entityId === run[index].entityId &&
        artist.affinity === run[index].affinity,
    )
  );
}

/**
 * The venues Qloo had no fan data for in a saved build (WS2): every run of the venue equals its
 * band's headliners-only ranking, entity id for entity id and in order, so adding the venue
 * changed nothing (Qloo leaves such venues unscored; docs/evidence.md section 35). Entity ids, in
 * the order the build read them. A band with no ranking to compare against, or an empty one,
 * never counts.
 */
export function noFanData({
  baselines,
  venueRuns,
}: Pick<AssemblyInput, "baselines" | "venueRuns">): string[] {
  const order = [...new Set(venueRuns.map((run) => run.venue.entityId))];
  return order.filter((venueId) =>
    venueRuns
      .filter((run) => run.venue.entityId === venueId)
      .every((run) => {
        const ranking = baselines[run.band];
        return (
          ranking !== undefined &&
          ranking.length > 0 &&
          ranking.length === run.artists.length &&
          ranking.every(
            (artist, index) => artist.entityId === run.artists[index].entityId,
          )
        );
      }),
  );
}
