import { FEE_BAND_IDS, type FeeBandId } from "./fee-bands";
import type { Act, Venue } from "./lineup";
import { roomShortName } from "./marks";

/** A Boise room behind the bill: the bands the agent tested it for, and the acts it lifted. */
export interface RoomLine {
  venue: Venue;
  /** The short name its marks use, when it differs from the full name. */
  short: string | null;
  bands: FeeBandId[];
  lifted: number;
}

/**
 * The rooms the build tested (its anchor venues per band) and any room an act on the bill
 * names, each with the acts on the bill it lifted. Unavailable acts don't count. Most first.
 */
export function roomsBehind(
  acts: readonly Act[],
  anchors: Partial<Record<FeeBandId, readonly Venue[]>>,
  unavailable: readonly string[] = [],
): RoomLine[] {
  const rooms = new Map<string, RoomLine>();
  const room = (venue: Venue) => {
    let line = rooms.get(venue.entityId);
    if (!line) {
      const short = roomShortName(venue.name);
      line = {
        venue: { entityId: venue.entityId, name: venue.name },
        short: short === venue.name ? null : short,
        bands: [],
        lifted: 0,
      };
      rooms.set(venue.entityId, line);
    }
    return line;
  };
  for (const band of FEE_BAND_IDS) {
    for (const venue of anchors[band] ?? []) {
      const line = room(venue);
      if (!line.bands.includes(band)) line.bands.push(band);
    }
  }
  for (const act of acts) {
    const line = room(act.anchorVenue);
    if (!unavailable.includes(act.entityId)) line.lifted += 1;
  }
  return [...rooms.values()].sort((a, b) => b.lifted - a.lifted);
}
