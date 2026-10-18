import type { FeeBandId } from "./fee-bands";
import type { Act } from "./lineup";
import { liftOf } from "./marks";
import type { Placed } from "./venue-switch";

/**
 * Where each act on a saved lineup stands on the chart: its place in its venue's ranking now,
 * and its place for the headliners' fans alone (null for a new entry). Read from the saved
 * build alone: the climb its reason states (src/lib/marks.ts) and its band's headliners-only
 * ranking. An act whose places the build can't tell is left out.
 */
export function billPlaces(
  acts: readonly Act[],
  baselines: Partial<Record<FeeBandId, readonly string[]>>,
): Record<string, Placed> {
  const places: Record<string, Placed> = {};
  for (const act of acts) {
    const lift = liftOf(act);
    if (lift?.kind === "new") {
      places[act.entityId] = { now: lift.top, was: null };
      continue;
    }
    const rank = baselines[act.band]?.indexOf(act.entityId) ?? -1;
    if (lift && rank >= 0)
      places[act.entityId] = { now: rank + 1 - lift.places, was: rank + 1 };
  }
  return places;
}
