import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { TraceCall } from "@/lib/build-events";
import type { FeeBand, FeeBandId } from "@/lib/fee-bands";
import { formatPopularity } from "@/lib/format";
import { actsInBand, type Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import { venueOfCall } from "@/lib/venue-call";
import type { Placed } from "@/lib/venue-switch";
import { exampleAct } from "./poster-words";
import { callWords, ordinal } from "./words";

/**
 * WS12 step 0 (Design 2.0, /lab/design-2): the prototype's words and picks, from the saved build
 * alone. The agent's setlist prints the build's Qloo calls as short numbered lines; it circles
 * the call that lifted the act the landing follows; the door check stamps that act's ticket
 * three times. Nothing here calls Qloo or the model.
 */

/** A tier as the setlist names it. */
const TIER: Record<FeeBandId, string> = { mid: "Mid-size", opener: "Opening" };

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export interface SetlistVenue {
  entityId: string;
  name: string;
}

/** One numbered line of the agent's setlist. */
export interface SetlistLine {
  n: number;
  /** The line, or, on a venue's line, what comes before the venue's name. */
  text: string;
  /** The venue a venue call read: the setlist sets its name in the venue's colour. */
  venue: SetlistVenue | null;
  /** On a venue's line, what follows its name. */
  after: string;
  /** The tier an artist call ranked; null for the other calls. */
  band: FeeBandId | null;
  /** The call's results in words ("50 acts"); null when the call didn't say. */
  count: string | null;
  /** Qloo had no fan data for the line's venue (src/lib/fan-data.ts). */
  noFanData: boolean;
  /** The AI agent's lines said before this call. */
  before: string[];
}

/** The tier a call's line names ("Mid-band artists for …"), by the festival's tier labels. */
function bandOf(summary: string, bands: readonly FeeBand[]): FeeBand | null {
  return (
    bands.find((band) =>
      new RegExp(`\\b${band.label}-band\\b`).test(summary),
    ) ?? null
  );
}

function countWords(call: TraceCall): string | null {
  const count = call.resultCount;
  if (count === null) return null;
  switch (call.tool) {
    case "search_artist":
      return plural(count, "match", "matches");
    case "find_tag":
    case "compare_headliners":
      return plural(count, "tag", "tags");
    case "find_venues":
      return plural(count, "place", "places");
    case "baseline_artists":
    case "venue_artists":
    case "refill":
    case "redraft":
      return plural(count, "act", "acts");
    default:
      return String(count);
  }
}

function lineWords(
  call: TraceCall,
  band: FeeBand | null,
  venue: SetlistVenue | undefined,
): Pick<SetlistLine, "text" | "after"> {
  const tier = band ? TIER[band.id] : null;
  const searched = /^Search for "(.+)"$/.exec(call.summary);
  const tag = /^Tags matching "(.+)"$/.exec(call.summary);
  const town = /^(.+) places tagged /.exec(call.summary);
  switch (call.tool) {
    case "search_artist":
      if (searched) return { text: `Look up ${searched[1]}`, after: "" };
      break;
    case "find_tag":
      if (tag) return { text: `Qloo's "${tag[1]}" tag`, after: "" };
      break;
    case "find_venues":
      if (town) return { text: `Live-music places in ${town[1]}`, after: "" };
      break;
    case "compare_headliners":
      return { text: "What both headliners' fans like", after: "" };
    case "baseline_artists":
      if (tier)
        return { text: `${tier}: the headliners' fans alone`, after: "" };
      break;
    case "venue_artists":
      if (tier && venue) return { text: `${tier} +`, after: "fans" };
      break;
    case "refill":
      if (tier && venue) return { text: `Refill · ${tier} +`, after: "fans" };
      break;
    case "redraft":
      if (tier && venue) return { text: `Redraft · ${tier} +`, after: "fans" };
      break;
    case "running_order":
      return { text: "Running order", after: "" };
  }
  return { text: callWords(call.summary), after: "" };
}

/**
 * The build's calls as the setlist prints them, each with the AI agent's lines said before it;
 * `closing` holds the lines said after the last call. A note's `at` is how many calls had come
 * back when it was said, so it sits before call `at + 1`.
 */
export function setlistLines(
  trace: readonly TraceCall[],
  {
    venues,
    bands,
    noFanData = [],
    notes = [],
  }: {
    venues: readonly SetlistVenue[];
    bands: readonly FeeBand[];
    noFanData?: readonly string[];
    notes?: readonly { at: number; text: string }[];
  },
): { lines: SetlistLine[]; closing: string[] } {
  const lines = trace.map((call): SetlistLine => {
    const band = bandOf(call.summary, bands);
    const venue = /^(venue_artists|refill|redraft)$/.test(call.tool)
      ? venueOfCall(call.summary, venues)
      : undefined;
    return {
      n: call.n,
      ...lineWords(call, band, venue),
      venue: venue ? { entityId: venue.entityId, name: venue.name } : null,
      band: band?.id ?? null,
      count: countWords(call),
      noFanData: venue ? noFanData.includes(venue.entityId) : false,
      before: notes
        .filter((note) => note.at === call.n - 1)
        .map((note) => note.text),
    };
  });
  const last = trace.length;
  return {
    lines,
    closing: notes.filter((note) => note.at >= last).map((note) => note.text),
  };
}

/**
 * The call that lifted an act: the venue call for its tier and its venue. The setlist circles
 * it. Null when no call of the build names the act's venue.
 */
export function liftingCall(
  trace: readonly TraceCall[],
  act: Pick<Act, "band" | "anchorVenue">,
  venues: readonly SetlistVenue[],
  bands: readonly FeeBand[],
): number | null {
  const call = trace.find(
    (entry) =>
      /^(venue_artists|refill|redraft)$/.test(entry.tool) &&
      bandOf(entry.summary, bands)?.id === act.band &&
      venueOfCall(entry.summary, venues)?.entityId === act.anchorVenue.entityId,
  );
  return call?.n ?? null;
}

/**
 * WS13.3's two climbs for an act, once its data carries them: places it climbed with the town's
 * venue, and with that venue's matched control abroad (src/lib/control-venue.ts).
 */
export interface TwoClimbs {
  venue: number;
  control: number;
}

/** The door check: what the ticket's three stamps carry for one act. */
export interface TicketStamps {
  /** Its climb with its venue's fans: the first stamp until WS13.3's climbs land. */
  climb: { kind: "up"; places: number } | { kind: "new"; top: number } | null;
  /** Its local lift (the venue's climb less the control's), the first stamp once they land. */
  local: { lift: number; venue: number; control: number } | null;
  /** The places a climb must reach (src/lib/assemble-lineup.ts). */
  bar: number;
  /** Its Qloo popularity on its tier's own scale, 0-100 as the card prints it. */
  popularity: { value: number; min: number; max: number };
  genres: [string, string];
}

export function ticketStamps(
  act: Pick<Act, "reason" | "popularity" | "sharedTags">,
  band: Pick<FeeBand, "minPopularity" | "maxPopularity">,
  climbs?: TwoClimbs | null,
): TicketStamps {
  const lift = liftOf(act);
  return {
    local: climbs
      ? {
          lift: climbs.venue - climbs.control,
          venue: climbs.venue,
          control: climbs.control,
        }
      : null,
    climb:
      lift?.kind === "up"
        ? { kind: "up", places: lift.places }
        : lift?.kind === "new"
          ? { kind: "new", top: lift.top }
          : null,
    bar: MIN_LIFT,
    popularity: {
      value: Number(formatPopularity(act.popularity)),
      min: Number(formatPopularity(band.minPopularity)),
      max: Number(formatPopularity(band.maxPopularity)),
    },
    genres: [act.sharedTags[0].name, act.sharedTags[1].name],
  };
}

/** The act's move, as the setlist writes it in the margin by its ringed call. */
export function marginNote(act: Act, place: Placed | undefined): string {
  const lift = liftOf(act);
  if (lift?.kind === "new")
    return `${act.name}: new in the top 50, at ${ordinal(place?.now ?? lift.top)}`;
  return place?.was
    ? `${act.name}: ${ordinal(place.was)} → ${ordinal(place.now)}`
    : act.name;
}

/**
 * The act the landing follows: the poster's first act, tier by tier in the order they print
 * (strongest Qloo match first), whose climb the build can tell, as the poster's example line.
 */
export function firstAct(
  acts: readonly Act[],
  places: Readonly<Record<string, Placed>>,
  bands: readonly FeeBand[],
): Act | null {
  const printed = bands.flatMap((band) => actsInBand(acts, band.id));
  return exampleAct(printed, places);
}
