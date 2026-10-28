import { feeBandFor, type FeeBand, type FeeBandId } from "./fee-bands";
import type { Act, Tag } from "./lineup";

/** An act must rank at least this many places higher with a venue in the signal to count. */
export const MIN_LIFT = 5;

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

export interface VenueRun {
  venue: VenueRef;
  band: FeeBandId;
  artists: RankedArtist[];
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

/** Weight per normalized tag name: one per headliner that carries it, plus the Compare score. */
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
    const best = new Map<string, { venue: VenueRef; lift: Lift }>();
    for (const run of input.venueRuns.filter(
      (candidate) => candidate.band === band.id,
    )) {
      for (const lift of liftsOver(baseline, run.artists)) {
        const current = best.get(lift.artist.entityId);
        const stronger =
          !current ||
          lift.lift > current.lift.lift ||
          (lift.lift === current.lift.lift &&
            (lift.artist.affinity ?? 0) > (current.lift.artist.affinity ?? 0));
        if (stronger)
          best.set(lift.artist.entityId, { venue: run.venue, lift });
      }
    }

    const booked = [...best.values()]
      .filter(({ lift }) => baseline.length > 0 && lift.lift >= MIN_LIFT)
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

    for (const { venue, lift, tags } of booked) {
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
      });
    }
    shortfall[band.id] = band.slots - booked.length;
  }

  return { acts, shortfall };
}
