import type { Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import type { Placed } from "@/lib/venue-switch";
import { ordinal } from "./words";

const places = (n: number) => `${n} ${n === 1 ? "place" : "places"}`;

/** Its climb with the venue abroad, in words: "it falls 15 places". */
const abroadWords = (controlClimb: number) =>
  controlClimb > 0
    ? `it climbs ${places(controlClimb)}`
    : controlClimb < 0
      ? `it falls ${places(-controlClimb)}`
      : "it doesn't move";

/**
 * An act's why in one sentence (plan.md item 5, the review's prompt D), from the saved build's
 * numbers only: its place with its venue's fans, its place for the headliners alone, and the
 * climb between them, the card's own three numbers. On a 2.0 act it names both climbs and the
 * local lift between them (Daniel, 2026-10-29, WS18 item 1). Without its places, the build's own
 * line, or on a 2.0 act its two climbs alone.
 */
export function whySentence(
  act: Pick<Act, "name" | "reason" | "anchorVenue" | "localLift">,
  place?: Placed | null,
): string {
  const lift = liftOf(act);
  const venue = act.anchorVenue.name;
  const added = `With ${venue}'s fans added to the headliners'`;
  const local = act.localLift;
  if (local) {
    const abroad = `With a venue abroad of similar Qloo popularity, ${abroadWords(local.controlClimb)}. That local lift of ${local.venueClimb - local.controlClimb} is why ${act.name} is here.`;
    if (lift?.kind === "up" && place?.was)
      return `${added}, Qloo ranks ${act.name} ${ordinal(place.now)}; for the headliners' fans alone, ${ordinal(place.was)}: a climb of ${local.venueClimb}. ${abroad}`;
    if (lift?.kind === "new")
      return `${added}, Qloo ranks ${act.name} ${ordinal(place?.now ?? lift.top)}; for the headliners' fans alone, it isn't in the top 50. ${abroad}`;
    return `${added}, ${act.name} climbs ${places(local.venueClimb)} in Qloo's ranking. ${abroad}`;
  }
  if (lift?.kind === "up" && place?.was)
    // The ranking is the headliners' fans with the venue's added, not the venue's fans alone (WS8).
    return `${added}, Qloo ranks ${act.name} ${ordinal(place.now)}; for the headliners' fans alone, ${ordinal(place.was)}. That climb of ${lift.places} is why ${act.name} is here.`;
  if (lift?.kind === "new")
    return `${added}, Qloo ranks ${act.name} ${ordinal(place?.now ?? lift.top)}; for the headliners' fans alone, it isn't in the top 50. That climb into the top 50 is why ${act.name} is here.`;
  return act.reason;
}
