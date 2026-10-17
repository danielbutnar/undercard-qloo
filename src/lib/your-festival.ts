import { z } from "zod";
import type { BuildEvent } from "./build-events";
import type { Festival } from "./festival";
import { SAGEBRUSH_SOUND } from "./sagebrush";

/**
 * "Your festival" (M6f): a judge's own town and two headliners, run live by the agent with
 * Sagebrush Sound's crowd, capacity and fee bands. Each run has its own festival id and is
 * never saved, so it can't become anyone's default.
 */
const NAME = z.string().trim().min(1).max(80);
// A town's name: letters first, then letters, marks, spaces, dots, hyphens and apostrophes.
const TOWN = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^\p{L}[\p{L}\p{M} .'’-]*$/u);

export const YourBriefSchema = z
  .object({
    city: TOWN,
    // The town's state or country, which resolves it (M6j): "Burlington" alone reads Ontario.
    region: TOWN,
    headliners: z.tuple([NAME, NAME]),
  })
  .refine(
    ({ headliners: [a, b] }) =>
      a.trim().toLowerCase() !== b.trim().toLowerCase(),
    { message: "Two different headliners, please.", path: ["headliners"] },
  );

/**
 * Whether Your festival takes a free-text town below the checked towns. M6j's re-measure
 * decides it (docs/evidence.md section 12): on only if at least 8 of its 10 US towns fill both
 * bands; otherwise Your festival offers only the checked towns.
 */
export const FREE_TEXT_TOWNS = true;

export type YourBrief = z.infer<typeof YourBriefSchema>;

export function yourFestival(brief: YourBrief, id: string): Festival {
  return {
    ...SAGEBRUSH_SOUND,
    id,
    name: "Your festival",
    city: brief.city.trim(),
    region: brief.region.trim(),
    headliners: [brief.headliners[0].trim(), brief.headliners[1].trim()],
    presale: [],
  };
}

/** Why a run left the bill short, in a form the page can design a state for. */
export type RunProblem = {
  code: "headliner-not-found" | "town-not-found" | "too-few-rooms" | "not-full";
  message: string;
};

/** Fewer live-music places than this, and the agent can't compare rooms. */
const MIN_PLACES = 2;

/**
 * Reads a finished run's events for the reason it couldn't fill both bands: a headliner Qloo
 * found nothing for, a town with too few live-music places, or rooms that lifted too few acts.
 */
export function diagnoseRun(
  events: readonly BuildEvent[],
  complete: boolean,
  city: string,
  /** The places the venue search kept (M6n); without it, the first venue call's count. */
  placesKept?: number,
): RunProblem | null {
  if (complete) return null;
  const calls = events.flatMap((event) =>
    event.type === "call" ? [event.call] : [],
  );
  const missing = calls.find(
    (call) => call.tool === "search_artist" && call.resultCount === 0,
  );
  if (missing) {
    const name =
      missing.params.find((param) => param.key === "query")?.value ?? "";
    return {
      code: "headliner-not-found",
      message: `Qloo found no artist called “${name}”. Check the spelling, or try another headliner.`,
    };
  }
  const venues = calls.find((call) => call.tool === "find_venues");
  const tested = calls.some(
    (call) => call.tool === "venue_artists" && !call.error,
  );
  const places = placesKept ?? venues?.resultCount ?? 0;
  // One sentence each (M6n); the checked towns offered below the sentence are the next step.
  if (venues && places === 0)
    return {
      code: "town-not-found",
      message: `Qloo found no live-music places in ${city}, so there were no rooms to read.`,
    };
  if (!venues || places < MIN_PLACES || !tested) {
    return {
      code: "too-few-rooms",
      message: `Qloo lists only ${places} live-music ${places === 1 ? "place" : "places"} in ${city}, too few for the agent to compare rooms.`,
    };
  }
  return {
    code: "not-full",
    message: `The ${city} rooms the agent tested lifted too few acts to fill every slot; the open slots are marked.`,
  };
}

/**
 * A link that opens Your festival with the form filled in (M6h): a booker can be sent one,
 * and nothing runs until they press the button.
 */
export function yourFestivalHref(brief: YourBrief): string {
  const search = new URLSearchParams([
    ["town", brief.city],
    ["region", brief.region],
    ["headliner", brief.headliners[0]],
    ["headliner", brief.headliners[1]],
  ]);
  return `/your-festival?${search}`;
}

/** The form's values from a link's query string, cut to the fields' lengths; null when empty. */
export function briefFromSearch(
  search: string,
): { city: string; region: string; first: string; second: string } | null {
  const params = new URLSearchParams(search);
  const city = (params.get("town") ?? "").slice(0, 60);
  const region = (params.get("region") ?? "").slice(0, 60);
  const [first = "", second = ""] = params
    .getAll("headliner")
    .map((name) => name.slice(0, 80));
  return city || region || first || second
    ? { city, region, first, second }
    : null;
}
