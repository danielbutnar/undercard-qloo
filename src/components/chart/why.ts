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
    // The ranking is the headliners' fans with the venue's added, not the venue's fans alone (WS8).
    return `With ${venue}'s fans added to the headliners', Qloo ranks ${act.name} ${ordinal(place.now)}; for the headliners' fans alone, ${ordinal(place.was)}. That climb of ${lift.places} is why ${act.name} is here.`;
  if (lift?.kind === "new")
    return `With ${venue}'s fans added to the headliners', Qloo ranks ${act.name} ${ordinal(place?.now ?? lift.top)}; for the headliners' fans alone, it isn't in the top 50. That climb into the top 50 is why ${act.name} is here.`;
  return act.reason;
}
