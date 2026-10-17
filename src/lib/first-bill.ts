import type { FeeBandId } from "./fee-bands";
import type { Act, Venue } from "./lineup";

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
}
