import { localLift as localLiftOf } from "./control-venue";
import { feeBandFor, type FeeBand, type FeeBandId } from "./fee-bands";
import type { Act, Tag } from "./lineup";

/** An act must rank at least this many places higher with a venue in the signal to count. */
export const MIN_LIFT = 5;

/**
 * Agent 2.0's bar (WS13.3): an act books only if its local lift, its climb with the town's venue
 * minus its climb with that venue's matched control abroad, is at least this many places. Set by
 * docs/evidence.md section 37's rule from its result of 2026-10-28 (244 of the 290 1.0 acts
 * reached 5, against a bar of 145), so 5 places; the climb of MIN_LIFT with the venue stays too.
 */
export const LOCAL_LIFT_BAR = 5;

export interface ArtistTag {
  id: string;
  name: string;
  type: string;
}

/** An artist from a Qloo Insights list, in list order. */
export interface RankedArtist {
  entityId: string;
  name: string;
  popularity: number;
  affinity: number | null;
  tags: ArtistTag[];
}

export interface VenueRef {
  entityId: string;
  name: string;
  /** What the room is when it isn't a club (M6l): carried to the act, never used to book. */
  kind?: string;
}

/** A venue's matched control abroad (WS13.3): a room in the control town, and its town. */
export interface ControlRef {
  entityId: string;
  name: string;
  town: string;
}

export interface VenueRun {
  venue: VenueRef;
  band: FeeBandId;
  artists: RankedArtist[];
  /**
   * The venue's matched control for this tier (WS13.3): the room and its ranking for the
   * headliners plus its fans, or null when no room in the control town had fan data, so this
   * run books no act. Absent on a 1.0 run, which the rule reads as before.
   */
  control?: { venue: ControlRef; artists: RankedArtist[] } | null;
  /**
   * Qloo had no fan data for the venue: its not-scored warning, or a ranking equal to the
   * headliners' own (WS13.1). Such a run books no act in any tier (Daniel, 2026-10-28): it stays
   * in the input only so the build's context and its switch still list the venue.
   */
  noFanData?: boolean;
}

export interface AssemblyInput {
  bands: readonly FeeBand[];
  headliners: { entityId: string; name: string; tags: ArtistTag[] }[];
  /** Tags Analysis Compare found the two headliners share, with Qloo's score. */
  comparedTags: { name: string; score: number }[];
  /** Per band, the artists ranked for the headliners alone. */
  baselines: Partial<Record<FeeBandId, readonly { entityId: string }[]>>;
  /** Per venue and band, the artists ranked for the headliners plus that venue. */
  venueRuns: VenueRun[];
}

export interface Lift {
  artist: RankedArtist;
  position: number;
  /** Places gained over the baseline; an act the baseline doesn't list counts from its end. */
  lift: number;
  inBaseline: boolean;
}

/** How far each artist in a venue run moved compared with the headliners-only baseline. */
export function liftsOver(
  baseline: readonly { entityId: string }[],
  artists: readonly RankedArtist[],
): Lift[] {
  const baselineRank = new Map(
    baseline.map((artist, rank) => [artist.entityId, rank]),
  );
  return artists.map((artist, position) => {
    const rank = baselineRank.get(artist.entityId);
    return {
      artist,
      position,
      lift: (rank ?? baseline.length) - position,
      inBaseline: rank !== undefined,
    };
  });
}

const normalize = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");
const isGenre = (tag: ArtistTag) =>
  /genre/.test(tag.type) || /:(sub)?genre:/.test(tag.id);
// Qloo writes some tag names with spaced hyphens ("Lo - Fi").
const tidy = (name: string) => name.replace(/\s*-\s*/g, "-").trim();

/**
 * Weight per normalized tag name: one per headliner that carries it, plus the Compare score of
 * each compared genre tag passed in (none as built: see assemblyOf in src/server/agent-tools.ts).
 */
export function headlinerTagWeights(input: AssemblyInput) {
  const weights = new Map<string, number>();
  for (const headliner of input.headliners) {
    for (const key of new Set(
      headliner.tags.filter(isGenre).map((tag) => normalize(tag.name)),
    )) {
      weights.set(key, (weights.get(key) ?? 0) + 1);
    }
  }
  for (const { name, score } of input.comparedTags) {
    const key = normalize(name);
    weights.set(key, (weights.get(key) ?? 0) + score);
  }
  return weights;
}

/**
 * How much of the headliners' taste an artist's genres carry (WS13.6): the weights of the genre
 * tags it shares with them, each tag once. 0 when it shares none.
 */
export function sharedWeight(
  artist: { tags?: readonly ArtistTag[] },
  weights: ReadonlyMap<string, number>,
): number {
  const keys = new Set(
    (artist.tags ?? []).filter(isGenre).map((tag) => normalize(tag.name)),
  );
  let total = 0;
  for (const key of keys) total += weights.get(key) ?? 0;
  return total;
}

/** An artist's genre tags the headliners carry, strongest first (two are needed to book it). */
export function sharedTags(
  artist: RankedArtist,
  weights: Map<string, number>,
): Tag[] {
  const seen = new Set<string>();
  return artist.tags
    .filter(isGenre)
    .filter((tag) => {
      const key = normalize(tag.name);
      if (!weights.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((tag, order) => ({
      tag,
      order,
      weight: weights.get(normalize(tag.name)) ?? 0,
    }))
    .sort((a, b) => b.weight - a.weight || a.order - b.order)
    .map(({ tag }) => ({ id: tag.id, name: tidy(tag.name) }));
}

function whyBoise(venue: VenueRef, lift: Lift) {
  return lift.inBaseline
    ? `${venue.name} fans move it up ${lift.lift} places.`
    : `${venue.name} fans move it into the top ${lift.position + 1}.`;
}

/**
 * Books each fee band's slots with the acts an anchor venue lifts at least MIN_LIFT places
 * above the headliners-only baseline, strongest Qloo affinity first. Every number comes from
 * Qloo; when too few acts qualify, the band is left short rather than padded.
 */
export function assembleLineup(input: AssemblyInput): {
  acts: Act[];
  shortfall: Record<FeeBandId, number>;
} {
  const weights = headlinerTagWeights(input);
  const headlinerIds = new Set(
    input.headliners.map((headliner) => headliner.entityId),
  );
  const acts: Act[] = [];
  const shortfall = { mid: 0, opener: 0 } as Record<FeeBandId, number>;

  for (const band of input.bands) {
    const baseline = input.baselines[band.id] ?? [];
    const best = new Map<
      string,
      { venue: VenueRef; lift: Lift; local?: Act["localLift"] }
    >();
    for (const run of input.venueRuns.filter(
      (candidate) => candidate.band === band.id && !candidate.noFanData,
    )) {
      for (const lift of liftsOver(baseline, run.artists)) {
        if (baseline.length === 0 || lift.lift < MIN_LIFT) continue;
        // WS13.3: on a 2.0 run, the climb counts only where the act's local lift reaches the bar.
        let local: Act["localLift"];
        if (run.control !== undefined) {
          if (run.control === null) continue;
          const ahead = localLiftOf(
            lift.artist.entityId,
            run.artists,
            run.control.artists,
          );
          if (ahead === null || ahead < LOCAL_LIFT_BAR) continue;
          local = {
            venueClimb: lift.lift,
            controlClimb: lift.lift - ahead,
            control: { ...run.control.venue },
          };
        }
        const current = best.get(lift.artist.entityId);
        const stronger =
          !current ||
          lift.lift > current.lift.lift ||
          (lift.lift === current.lift.lift &&
            (lift.artist.affinity ?? 0) > (current.lift.artist.affinity ?? 0));
        if (stronger)
          best.set(lift.artist.entityId, {
            venue: run.venue,
            lift,
            ...(local ? { local } : {}),
          });
      }
    }

    const booked = [...best.values()]
      .filter(
        ({ lift }) =>
          lift.artist.affinity !== null &&
          !headlinerIds.has(lift.artist.entityId),
      )
      .filter(
        ({ lift }) =>
          feeBandFor(lift.artist.popularity, input.bands)?.id === band.id,
      )
      .map((candidate) => ({
        ...candidate,
        tags: sharedTags(candidate.lift.artist, weights),
      }))
      .filter(({ tags }) => tags.length >= 2)
      .sort(
        (a, b) =>
          (b.lift.artist.affinity ?? 0) - (a.lift.artist.affinity ?? 0) ||
          b.lift.lift - a.lift.lift,
      )
      .slice(0, band.slots);

    for (const { venue, lift, tags, local } of booked) {
      acts.push({
        entityId: lift.artist.entityId,
        name: lift.artist.name,
        band: band.id,
        affinity: lift.artist.affinity ?? 0,
        popularity: lift.artist.popularity,
        anchorVenue: {
          entityId: venue.entityId,
          name: venue.name,
          ...(venue.kind ? { kind: venue.kind } : {}),
        },
        reason: whyBoise(venue, lift),
        sharedTags: [tags[0], tags[1]],
        ...(local ? { localLift: local } : {}),
      });
    }
    shortfall[band.id] = band.slots - booked.length;
  }

  return { acts, shortfall };
}
