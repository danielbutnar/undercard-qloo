import type { AgentSwitch } from "./agent-switch";
import type { ArtistImages } from "./artist-images";
import type { FeeBand } from "./fee-bands";
import type { Festival } from "./festival";
import type { FirstBill } from "./first-bill";
import type { Act, Venue } from "./lineup";
import { liftOf } from "./marks";
import type { Placed } from "./venue-switch";

/** A venue the AI agent read for the build, and how many acts its fans put on the lineup. */
export interface StoryVenue extends Venue {
  lifted: number;
}

/**
 * What How it works follows through the saved build (M10b, docs/evidence.md section 28): the
 * first mid-size act on the lineup, from its place for the headliners' fans alone to its slot,
 * and the venues the AI agent read. Every number is the build's, read when the page is served.
 */
export interface MethodStory {
  buildId: string;
  /** Qloo calls the build made. */
  calls: number;
  act: Act;
  band: FeeBand;
  /** Its place for the headliners' fans alone (was) and with its venue's fans added (now). */
  place: Placed | null;
  /** Places it climbed with its venue's fans; null for an act new to the top 50. */
  climb: number | null;
  fresh: boolean;
  /** The venues the agent read, in the order it read them. */
  venues: StoryVenue[];
  /** Live-music places Qloo listed in the town; null when the build didn't say. */
  placesListed: number | null;
  /** The lineup and each act's places, as the first screen shows them. */
  acts: Act[];
  places: Record<string, Placed>;
  /** Each act's image on Qloo, as on the first screen, while ARTIST_IMAGES is on. */
  images?: ArtistImages;
  /** Where the saved trace shows the planner switch venue (WS2); left out when it shows none. */
  switches?: AgentSwitch[];
  /** The venues Qloo had no fan data for, by entity id (WS2); left out when there are none. */
  noFanData?: string[];
}

export function methodStory(
  festival: Festival,
  bill: FirstBill | null,
): MethodStory | null {
  if (!bill) return null;
  const band = festival.feeBands[0];
  const act = bill.acts.find((entry) => entry.band === band.id);
  if (!act) return null;
  const lift = liftOf(act);
  const read = new Map<string, Venue>();
  for (const venue of festival.feeBands.flatMap(
    (entry) => bill.anchors[entry.id] ?? [],
  ))
    if (!read.has(venue.entityId)) read.set(venue.entityId, venue);
  return {
    buildId: bill.build.id,
    calls: bill.calls,
    act,
    band,
    place: bill.places?.[act.entityId] ?? null,
    climb: lift?.kind === "up" ? lift.places : null,
    fresh: lift?.kind === "new",
    venues: [...read.values()].map((venue) => ({
      entityId: venue.entityId,
      name: venue.name,
      lifted: bill.acts.filter(
        (entry) => entry.anchorVenue.entityId === venue.entityId,
      ).length,
    })),
    placesListed: bill.placesListed,
    acts: bill.acts,
    places: bill.places ?? {},
    ...(bill.images ? { images: bill.images } : {}),
    ...(bill.agentSwitches ? { switches: bill.agentSwitches } : {}),
    ...(bill.noFanData ? { noFanData: bill.noFanData } : {}),
  };
}
