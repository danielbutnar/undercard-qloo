import { pickTag } from "@/components/chart/poster-words";
import { ordinal } from "@/components/chart/words";
import type { Festival } from "@/lib/festival";
import type { ShortlistAct, ShortlistVenue } from "@/lib/shortlist";

/** What the shortlist page says (WS4), in one place, plain words first. */

type Found = Extract<ShortlistAct, { status: "found" }>;
type Missing = Exclude<ShortlistAct, { status: "found" }>;

/** The page's one sentence at the top (Daniel's words). */
export const SHORTLIST_LEAD =
  "Paste the acts you've been pitched; Undercard sorts them by how fans of this town's venues rank them. You make every call.";

export const SHORTLIST_TITLE = "Check a shortlist";
export const CHECK_BUTTON = "Sort them on Qloo";

const places = (n: number) => (n === 1 ? "1 place" : `${n} places`);

/** The venue whose fans lift the act most, and by how many places; or that none does. */
export function climbWords(
  act: Found,
  venues: readonly ShortlistVenue[],
): string {
  const venue = venues.find((entry) => entry.entityId === act.best?.venueId);
  if (act.climb !== null && act.climb > 0 && act.best && act.alone && venue)
    return `${venue.name}'s fans lift it ${places(act.climb)}, ${ordinal(act.alone)} to ${ordinal(act.best.place)}`;
  if (act.alone !== null)
    return `No venue's fans lift it: ${ordinal(act.alone)} for the headliners' fans alone`;
  return "Qloo gave it no place for the headliners' fans";
}

/**
 * Its Qloo popularity against the two fee ranges, in the Without Qloo cards' words (pickTag):
 * in the mid-size range, in the opening range, above or below both.
 */
export function feeWords(
  act: Found,
  festival: Pick<Festival, "feeBands">,
): string {
  const tag = pickTag(
    {
      name: act.name,
      status: "found",
      popularity: act.popularity,
      range: act.range,
      genres: act.genres.length,
      climb: act.climb,
    },
    festival,
  );
  return `Qloo popularity ${tag}`;
}

/** Whether it shares two genres with the headliners, as the rule needs, and which. */
export function genreWords(act: Pick<Found, "genres">): string {
  const { genres } = act;
  if (genres.length === 0) return "No genre shared with the headliners";
  if (genres.length === 1)
    return `Only 1 genre shared with the headliners: ${genres[0]}`;
  return `${genres.length} genres shared with the headliners: ${genres.join(", ")}`;
}

/** Why a name has no numbers. */
export function missingWords(act: Missing): string {
  if (act.status === "not-found") return "Not found on Qloo";
  if (act.status === "not-checked") return "Not checked on Qloo";
  return "One of your headliners, so not ranked";
}

/** What a venue's fans did for the shortlist, or that Qloo had no fan data for it. */
export function venueWords(venue: ShortlistVenue, cap: number): string {
  if (!venue.read)
    return `${venue.name}: not read, the check's ${cap} Qloo calls ran out`;
  if (venue.noFanData) return `Qloo had no fan data for ${venue.name}`;
  return venue.lifts === 0
    ? `${venue.name}'s fans lift none of your acts`
    : `${venue.name}'s fans lift ${venue.lifts} of your acts`;
}

/** The climb's one-line key over the rows. */
export const CLIMB_KEY =
  "places it climbs among your acts once a venue's fans join the headliners' fans";
