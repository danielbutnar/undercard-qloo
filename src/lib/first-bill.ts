import type { AgentSwitch } from "./agent-switch";
import type { ArtistImages } from "./artist-images";
import type { FeeBandId } from "./fee-bands";
import type { Act, Venue } from "./lineup";
import type { Placed, VenueSwitchData } from "./venue-switch";

/** What the first screen needs from the latest saved build, read on the server. */
export interface FirstBill {
  build: { id: string; createdAt: string };
  acts: Act[];
  /** Qloo calls the build made. */
  calls: number;
  /** Boise live-music places Qloo listed, from the build's venue search; null without one. */
  placesListed: number | null;
  /** Per band, the rooms the build tested, in the order it ran them. */
  anchors: Partial<Record<FeeBandId, Venue[]>>;
  /** Per band, how many acts the headliners-only ranking listed. */
  baselineTop: Partial<Record<FeeBandId, number>>;
  /** Each act's place on the chart now and for the headliners alone (src/lib/places.ts). */
  places?: Record<string, Placed>;
  /** Each act's image on Qloo, only while ARTIST_IMAGES is on (src/lib/artist-images.ts). */
  images?: ArtistImages;
  /** The venue switch worked out on the server from the Qloo cache, so it's on first paint. */
  venueSwitch?: VenueSwitchData;
  /** Where the saved trace shows the planner switch venue (src/lib/agent-switch.ts); left out
   * when it shows none. */
  agentSwitches?: AgentSwitch[];
  /** The venues Qloo had no fan data for (src/lib/fan-data.ts), by entity id, from the server's
   * Qloo cache; left out when there are none. */
  noFanData?: string[];
}
