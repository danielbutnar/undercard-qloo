import type { AssemblyInput } from "./assemble-lineup";

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
