import type { Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import type { Placed } from "@/lib/venue-switch";
import { ordinal } from "./words";

/**
 * An act's why in one sentence (plan.md item 5, the review's prompt D), from the saved build's
 * numbers only: its place with its venue's fans, its place for the headliners alone, and the
 * climb between them, the card's own three numbers. Without its places, the build's own line.
 */
export function whySentence(
  act: Pick<Act, "name" | "reason" | "anchorVenue">,
  place?: Placed | null,
): string {
  const lift = liftOf(act);
  const venue = act.anchorVenue.name;
  if (lift?.kind === "up" && place?.was)
    return `Fans of ${venue} rank ${act.name} ${ordinal(place.now)}; fans of the headliners alone rank them ${ordinal(place.was)}. That climb of ${lift.places} is why ${act.name} is here.`;
  if (lift?.kind === "new")
    return `Fans of ${venue} rank ${act.name} ${ordinal(place?.now ?? lift.top)}; fans of the headliners alone don't rank them in their top 50. That climb into the top 50 is why ${act.name} is here.`;
  return act.reason;
}
