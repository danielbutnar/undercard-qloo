import { z } from "zod";
import { ageBuckets } from "@/lib/ages";
import { MIN_LIFT } from "@/lib/assemble-lineup";
import type { CheckedTown } from "@/lib/checked-towns";
import {
  climb,
  controlCandidates,
  localLift,
  matchControl,
  noFanData,
  placeIn,
  type NoFanData,
  RANKED_PLACES,
  type Room,
} from "@/lib/control-venue";
import { FEE_BAND_IDS, type FeeBand, type FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import { controlTownFor } from "@/lib/premise-controls";
import { RawEntity, toEntity, type QlooPath } from "@/lib/qloo/core";
import {
  needsFullName,
  placesInRegion,
  type PlaceWhere,
} from "@/lib/town-resolution";
import { checkedFestival } from "@/lib/towns";
import { pinnedBuilds, readOnlyCache } from "./attribution-warm";
import { createBuildStore, type SavedBuild } from "./build-store";
import type { QlooCache } from "./qloo-cache";

/**
 * The logic of scripts/control-test-37.ts: docs/evidence.md section 37, the control test across
 * the 29 towns. For each saved build, each venue it read is matched, in each tier it read it
 * for, to the music room in the festival's control town whose Qloo popularity is closest
 * (src/lib/control-venue.ts), both are ranked on the run's day with the agent's own parameters,
 * and each booked act gets its local lift. Everything Qloo is asked goes through `ask`, the
 * script's own client with its own memory; nothing here reads or writes the server's cache.
 */

/** Section 37's bar: a local lift of at least 5 places for at least half of the 290 acts. */
export const LOCAL_LIFT_BAR = 5;
/** The product's bar when section 37's isn't met (Daniel's rule of 24 October). */
export const LOCAL_LIFT_FALLBACK = 3;
export const ALL_ACTS = 290;
export const BAR_ACTS = 145;
/** find_venues' take: the places Qloo lists for a town (src/lib/qloo/insights.ts). */
export const VENUES_TAKE = 20;

/** Undercard 2.0's bar, by section 37's rule: 5 places when its bar is met, otherwise 3. */
export function productBar(atBar: number): 5 | 3 {
  return atBar >= BAR_ACTS ? LOCAL_LIFT_BAR : LOCAL_LIFT_FALLBACK;
}

/** One GET to Qloo, by path and parameters; the answer's body comes back. */
export type Ask = (
  path: QlooPath,
  params: Record<string, string | number>,
) => Promise<unknown>;

/** A call's identity, as the app's cache keys it: the path and its sorted parameters. */
export function callKey(
  path: string,
  params: Record<string, string | number>,
): string {
  const entries = Object.entries(params)
    .map(([key, value]): [string, string] => [key, String(value)])
    .sort();
  return `${path}?${new URLSearchParams(entries).toString()}`;
}

/** A checked town's festival: its town, the brief, and its saved build (the latest pointer's). */
export interface FestivalInput {
  town: CheckedTown;
  festival: Festival;
  build: SavedBuild;
}

/**
 * Each town's festival with its latest saved build, read from the store through a read-only
 * cache; every build must be the one pinned in .design/pinned-builds/, or nothing runs. The
 * store's own keys are the only ones read.
 */
export async function readFestivals({
  serverCache,
  towns,
  pinned,
}: {
  serverCache: QlooCache;
  towns: readonly CheckedTown[];
  pinned: unknown;
}): Promise<FestivalInput[]> {
  const festivals = towns.map((town) => ({
    town,
    festival: checkedFestival(town),
  }));
  const builds = await pinnedBuilds({
    store: createBuildStore(readOnlyCache(serverCache)),
    festivalIds: festivals.map((entry) => entry.festival.id),
    pinned,
  });
  return festivals.map((entry, index) => ({ ...entry, build: builds[index] }));
}

/**
 * The control town: section 34's Control A town, the next checked town in alphabetical order
 * that is in another country, wrapping round. Section 34 also asked for as many anchor venues
 * as the festival's town had; section 37 picks one music room there, so it has no such clause.
 */
export function controlTownOf(
  towns: readonly CheckedTown[],
  city: string,
): CheckedTown {
  const town = controlTownFor(towns, () => 0, city, 0);
  if (!town) throw new Error(`No control town for ${city}.`);
  return town;
}

/** The festival whose town is this one's control town. */
export function controlFestivalFor(
  festivals: readonly FestivalInput[],
  towns: readonly CheckedTown[],
  own: FestivalInput,
): FestivalInput {
  const town = controlTownOf(towns, own.town.city);
  const found = festivals.find((entry) => entry.town.city === town.city);
  if (!found) throw new Error(`No saved build for ${town.city}.`);
  return found;
}

/** venue_artists' and baseline_artists' parameters (src/server/agent-tools.ts), in order. */
export function rankingParams({
  headliners,
  input,
  band,
  ages,
}: {
  headliners: readonly string[];
  /** The venue or control whose fans join the headliners'; null for the headliners alone. */
  input: string | null;
  band: Pick<FeeBand, "minPopularity" | "maxPopularity">;
  ages: readonly string[];
}): Record<string, string | number> {
  const params: Record<string, string | number> = {
    "filter.type": "urn:entity:artist",
    "signal.interests.entities": [
      ...headliners,
      ...(input ? [input] : []),
    ].join(","),
    "filter.popularity.min": band.minPopularity,
    "filter.popularity.max": band.maxPopularity,
  };
  if (headliners.length)
    params["filter.exclude.entities"] = headliners.join(",");
  if (ages.length) params["signal.demographics.age"] = ages.join(",");
  params.take = RANKED_PLACES;
  return params;
}

/** find_venues' parameters (src/lib/qloo/insights.ts, places). */
export function placesParams(
  locationQuery: string,
  tagId: string,
): Record<string, string | number> {
  return {
    "filter.type": "urn:entity:place",
    "filter.location.query": locationQuery,
    "filter.tags": tagId,
    take: VENUES_TAKE,
  };
}

/** GET /entities' parameters (src/lib/qloo/entities.ts): places looked up by id. */
export function entitiesParams(
  ids: readonly string[],
): Record<string, string | number> {
  return { entity_ids: ids.join(",") };
}

/** An answer whose shape the run can't read: the run stops rather than guess. */
export class UnreadableAnswer extends Error {
  constructor(what: string) {
    super(`Qloo's answer for ${what} isn't in the shape the run reads.`);
    this.name = "UnreadableAnswer";
  }
}

const RankingBody = z.object({
  results: z.object({ entities: z.array(z.object({ entity_id: z.string() })) }),
});
const PlacesBody = z.object({
  results: z.object({ entities: z.array(RawEntity) }),
});
const EntitiesBody = z.object({
  results: z.array(
    z.object({ entity_id: z.string(), popularity: z.number().optional() }),
  ),
});

function read<T>(schema: z.ZodType<T>, body: unknown, what: string): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new UnreadableAnswer(what);
  return parsed.data;
}

/** The popularity /entities gave each place it knows, by entity id. */
export function popularitiesOf(body: unknown): Map<string, number> {
  return new Map(
    read(EntitiesBody, body, "places by id").results.flatMap((entity) =>
      typeof entity.popularity === "number"
        ? [[entity.entity_id, entity.popularity] as const]
        : [],
    ),
  );
}

/** The entity ids of a ranking, in Qloo's order. */
export function rankingOf(body: unknown): string[] {
  return read(RankingBody, body, "a ranking").results.entities.map(
    (entity) => entity.entity_id,
  );
}

/** The signal inputs a Qloo answer reports as not found: Qloo couldn't use their fans. */
export function unscoredInputs(body: unknown): string[] {
  const warnings =
    body && typeof body === "object"
      ? (body as { warnings?: unknown }).warnings
      : undefined;
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((warning) => {
    if (!warning || typeof warning !== "object") return [];
    const entry = warning as Record<string, unknown>;
    const inputs = entry["signal.interests.entities"];
    return entry.type === "not_found" && Array.isArray(inputs)
      ? inputs.filter((value): value is string => typeof value === "string")
      : [];
  });
}

/** A music room a find_venues answer lists, with where Qloo puts it. */
export interface TownRoom extends Room {
  popularity: number | null;
  where?: PlaceWhere;
}

function roomsOf(body: unknown): TownRoom[] {
  return read(PlacesBody, body, "a town's music rooms").results.entities.map(
    (raw) => {
      const entity = toEntity(raw);
      return {
        entityId: entity.entityId,
        name: entity.name,
        popularity: raw.popularity ?? null,
        ...(entity.where ? { where: entity.where } : {}),
      };
    },
  );
}

/**
 * The agent's find_venues for a town (src/server/agent-tools.ts): the plain name first; when its
 * places miss the region, once more as "town, region", and the answer with more places in the
 * region stands (M6j). `answers` keeps every answer, for a venue's popularity.
 */
export async function findVenues(
  ask: Ask,
  town: Pick<CheckedTown, "city" | "region">,
  tagId: string,
): Promise<{ rooms: TownRoom[]; answers: TownRoom[][] }> {
  const plain = roomsOf(
    await ask("/v2/insights", placesParams(town.city, tagId)),
  );
  const answers = [plain];
  if (needsFullName(plain, town.region))
    answers.push(
      roomsOf(
        await ask(
          "/v2/insights",
          placesParams(`${town.city}, ${town.region}`, tagId),
        ),
      ),
    );
  const rooms =
    answers.length > 1 ? placesInRegion(answers, town.region).places : plain;
  return { rooms, answers };
}

/** The live-music-venue tag the build's own find_venues sent. */
export function venueTagOf(build: SavedBuild): string {
  const tag = build.trace
    .find((call) => call.tool === "find_venues")
    ?.params.find((param) => param.key === "filter.tags")?.value;
  if (!tag)
    throw new Error(
      `Build ${build.id} has no find_venues call with a tag in its trace.`,
    );
  return tag;
}

/** Each venue the build read, in each tier it read it for: tier by tier, in the build's order. */
export function venueRunsOf(build: SavedBuild) {
  return FEE_BAND_IDS.flatMap((band) =>
    (build.context.anchors[band] ?? []).map((venue) => ({ band, venue })),
  );
}

export interface RoomRef {
  entityId: string;
  name: string;
  popularity: number | null;
}

export interface VenueRunResult {
  band: FeeBandId;
  venue: RoomRef & {
    /**
     * Where the venue's popularity came from: its town's find_venues, or /entities; null when
     * neither gave one, and the control town's rooms were tried in Qloo's own order.
     */
    popularityFrom: "find_venues" | "entities" | null;
  };
  /** The matched control: the closest room with fan data in the control town; null when none. */
  control: RoomRef | null;
  /** Closer rooms with no fan data, skipped for the next, each with why. */
  skipped: (RoomRef & { because: NoFanData })[];
  /** The rooms the rule could try, in its order. */
  candidates: number;
  /**
   * The town venue had no fan data that day: Qloo warned it wasn't scored, or its ranking was the
   * headliners-only one. Its acts keep that day's climb and count against the bar.
   */
  venueNoFanData: NoFanData | null;
  withVenue: string[];
  withControl: string[] | null;
}

export type NoLiftReason = "no scored control" | "no venue run";

export interface ActResult {
  entityId: string;
  name: string;
  band: FeeBandId;
  venue: { entityId: string; name: string };
  headlinersOnlyPlace: number;
  venuePlace: number | null;
  controlPlace: number | null;
  localLift: number | null;
  /** Its climb with its town venue that day: the drift's description. */
  climbToday: number | null;
  noLiftBecause: NoLiftReason | null;
  /** Its town venue had no fan data that day: it counts against the bar, whatever its lift. */
  venueNoFanData: NoFanData | null;
}

export interface FestivalResult {
  festivalId: string;
  city: string;
  controlCity: string;
  buildId: string;
  builtAt: string;
  venueRuns: VenueRunResult[];
  acts: ActResult[];
}

const refOf = (room: TownRoom): RoomRef => ({
  entityId: room.entityId,
  name: room.name,
  popularity: room.popularity,
});

/**
 * One festival: the control town's rooms, the town's own (for each venue's popularity, from
 * /entities where the town's answer lacks it), each tier's ranking for the headliners alone,
 * then each venue read with its matched control, and each booked act's places and local lift.
 */
export async function runFestival(
  ask: Ask,
  own: FestivalInput,
  control: FestivalInput,
  {
    /**
     * Look every venue the build read up on /entities right after find_venues, whatever
     * find_venues lists: the run's first festival does, so its first calls show whether /entities
     * gives a place's popularity. The answer also serves as the fallback.
     */
    probeEntities = false,
  }: { probeEntities?: boolean } = {},
): Promise<FestivalResult> {
  const { build, festival } = own;
  const headliners = build.context.headliners.map((entry) => entry.entityId);
  const ages = ageBuckets(festival.crowdAge.min, festival.crowdAge.max).buckets;
  const runs = venueRunsOf(build);

  const controlRooms = (
    await findVenues(ask, control.town, venueTagOf(control.build))
  ).rooms;
  const ownAnswers = (await findVenues(ask, own.town, venueTagOf(build)))
    .answers;

  const venueIds = [...new Set(runs.map((run) => run.venue.entityId))];
  const fromEntities = new Map<string, number>();
  const lookUp = async (ids: string[]) => {
    for (const [id, value] of popularitiesOf(
      await ask("/entities", entitiesParams(ids)),
    ))
      fromEntities.set(id, value);
  };
  if (probeEntities && venueIds.length) await lookUp(venueIds);

  const popularity = new Map<
    string,
    { value: number; from: "find_venues" | "entities" }
  >();
  for (const room of ownAnswers.flat())
    if (room.popularity !== null && !popularity.has(room.entityId))
      popularity.set(room.entityId, {
        value: room.popularity,
        from: "find_venues",
      });
  const missing = venueIds.filter((id) => !popularity.has(id));
  if (missing.length && !probeEntities) await lookUp(missing);
  for (const id of missing) {
    const value = fromEntities.get(id);
    if (value !== undefined) popularity.set(id, { value, from: "entities" });
  }

  const bandOf = (id: FeeBandId) => {
    const band = festival.feeBands.find((entry) => entry.id === id);
    if (!band) throw new Error(`${festival.id} has no ${id} tier.`);
    return band;
  };
  const rank = async (band: FeeBandId, input: string | null) => {
    const body = await ask(
      "/v2/insights",
      rankingParams({ headliners, input, band: bandOf(band), ages }),
    );
    return { ids: rankingOf(body), unscored: unscoredInputs(body) };
  };

  const headlinersOnly = new Map<FeeBandId, string[]>();
  for (const band of festival.feeBands)
    headlinersOnly.set(band.id, (await rank(band.id, null)).ids);

  const venueRuns: VenueRunResult[] = [];
  for (const { band, venue } of runs) {
    const withVenue = await rank(band, venue.entityId);
    const known = popularity.get(venue.entityId);
    const candidates = controlCandidates(controlRooms, known?.value ?? null);
    const rankings = new Map<string, string[]>();
    const reasons = new Map<string, NoFanData>();
    const { control: matched, skipped } = await matchControl(
      candidates,
      async (room) => {
        const answer = await rank(band, room.entityId);
        rankings.set(room.entityId, answer.ids);
        const reason = noFanData({
          warned: answer.unscored.includes(room.entityId),
          ranking: answer.ids,
          without: headlinersOnly.get(band) ?? [],
        });
        if (reason) reasons.set(room.entityId, reason);
        return reason === null;
      },
    );
    const withControl = matched ? rankings.get(matched.entityId)! : null;
    venueRuns.push({
      band,
      venue: {
        entityId: venue.entityId,
        name: venue.name,
        popularity: known?.value ?? null,
        popularityFrom: known?.from ?? null,
      },
      control: matched ? refOf(matched) : null,
      skipped: skipped.map((room) => ({
        ...refOf(room),
        because: reasons.get(room.entityId)!,
      })),
      candidates: candidates.length,
      venueNoFanData: noFanData({
        warned: withVenue.unscored.includes(venue.entityId),
        ranking: withVenue.ids,
        without: headlinersOnly.get(band) ?? [],
      }),
      withVenue: withVenue.ids,
      withControl,
    });
  }

  const acts = build.lineup.acts.map((act): ActResult => {
    const run = venueRuns.find(
      (entry) =>
        entry.band === act.band &&
        entry.venue.entityId === act.anchorVenue.entityId,
    );
    const alone = headlinersOnly.get(act.band) ?? [];
    const noLiftBecause: NoLiftReason | null = !run
      ? "no venue run"
      : run.withControl === null
        ? "no scored control"
        : null;
    return {
      entityId: act.entityId,
      name: act.name,
      band: act.band,
      venue: { entityId: act.anchorVenue.entityId, name: act.anchorVenue.name },
      headlinersOnlyPlace: placeIn(alone, act.entityId),
      venuePlace: run ? placeIn(run.withVenue, act.entityId) : null,
      controlPlace: run?.withControl
        ? placeIn(run.withControl, act.entityId)
        : null,
      localLift: run
        ? localLift(act.entityId, run.withVenue, run.withControl)
        : null,
      climbToday: run ? climb(act.entityId, alone, run.withVenue) : null,
      noLiftBecause,
      venueNoFanData: run?.venueNoFanData ?? null,
    };
  });

  return {
    festivalId: festival.id,
    city: own.town.city,
    controlCity: control.town.city,
    buildId: build.id,
    builtAt: build.createdAt,
    venueRuns,
    acts,
  };
}

export interface Counts {
  acts: number;
  atBar: number;
  atFallback: number;
}

export interface Summary extends Counts {
  /** Every town measured; until then the bar isn't set. */
  complete: boolean;
  towns: number;
  byTown: (Counts & {
    city: string;
    controlCity: string;
    stillClimb: number;
    noScoredControl: number;
  })[];
  byTier: Record<FeeBandId, Counts>;
  venueRuns: number;
  /** Rooms skipped for no fan data, once per venue run and tier that skipped one. */
  controlsSkipped: number;
  /** Of them, those Qloo warned weren't scored, and those whose ranking was the headliners' own. */
  controlsSkippedByWarning: number;
  controlsSkippedByEqualRanking: number;
  /** Venue runs that found no room with fan data in their control town. */
  venueRunsWithoutControl: number;
  /** The control towns where a venue run found no room with fan data. */
  controlTownsWithoutFanData: number;
  /** The different rooms among them. */
  roomsSkipped: number;
  noScoredControl: number;
  /** The drift, a description: acts that still climb at least 5 with their venue that day. */
  stillClimb: number;
  /** Where the town venues' popularity came from, each venue of each festival once. */
  popularitySources: { find_venues: number; entities: number; none: number };
  /** Venue runs whose town venue had no fan data that day, by why. */
  townVenuesWithoutFanData: { warning: number; equalRanking: number };
  /** Their acts, counted against the bar; and how many of them the arithmetic alone puts at 5. */
  actsWithTownVenueWithoutFanData: number;
  actsWithTownVenueWithoutFanDataAtLift5: number;
  barMet: boolean | null;
  productBar: 5 | 3 | null;
}

/** An act reaches a bar only with a control, a town venue that had fan data, and the lift. */
const reaches = (act: ActResult, bar: number) =>
  act.venueNoFanData === null && act.localLift !== null && act.localLift >= bar;

function counts(acts: readonly ActResult[]): Counts {
  return {
    acts: acts.length,
    atBar: acts.filter((act) => reaches(act, LOCAL_LIFT_BAR)).length,
    atFallback: acts.filter((act) => reaches(act, LOCAL_LIFT_FALLBACK)).length,
  };
}

function popularitySourcesOf(results: readonly FestivalResult[]) {
  const sources = { find_venues: 0, entities: 0, none: 0 };
  for (const result of results) {
    const seen = new Set<string>();
    for (const run of result.venueRuns) {
      if (seen.has(run.venue.entityId)) continue;
      seen.add(run.venue.entityId);
      sources[run.venue.popularityFrom ?? "none"]++;
    }
  }
  return sources;
}

const stillClimbs = (acts: readonly ActResult[]) =>
  acts.filter((act) => (act.climbToday ?? -Infinity) >= MIN_LIFT).length;
const withNoControl = (acts: readonly ActResult[]) =>
  acts.filter((act) => act.noLiftBecause === "no scored control").length;

/** The counts section 37 reports, over the festivals measured so far. */
export function summarise(
  results: readonly FestivalResult[],
  { towns }: { towns: number },
): Summary {
  const acts = results.flatMap((result) => result.acts);
  const runs = results.flatMap((result) => result.venueRuns);
  const complete = results.length === towns;
  const all = counts(acts);
  const skippedBy = (reason: NoFanData) =>
    runs.reduce(
      (sum, run) =>
        sum + run.skipped.filter((room) => room.because === reason).length,
      0,
    );
  return {
    complete,
    towns: results.length,
    ...all,
    byTown: results.map((result) => ({
      city: result.city,
      controlCity: result.controlCity,
      ...counts(result.acts),
      stillClimb: stillClimbs(result.acts),
      noScoredControl: withNoControl(result.acts),
    })),
    byTier: Object.fromEntries(
      FEE_BAND_IDS.map((band) => [
        band,
        counts(acts.filter((act) => act.band === band)),
      ]),
    ) as Record<FeeBandId, Counts>,
    venueRuns: runs.length,
    controlsSkipped: runs.reduce((sum, run) => sum + run.skipped.length, 0),
    controlsSkippedByWarning: skippedBy("warning"),
    controlsSkippedByEqualRanking: skippedBy("equal ranking"),
    venueRunsWithoutControl: runs.filter((run) => run.control === null).length,
    controlTownsWithoutFanData: new Set(
      results.flatMap((result) =>
        result.venueRuns.some((run) => run.control === null)
          ? [result.controlCity]
          : [],
      ),
    ).size,
    roomsSkipped: new Set(
      runs.flatMap((run) => run.skipped.map((room) => room.entityId)),
    ).size,
    noScoredControl: withNoControl(acts),
    stillClimb: stillClimbs(acts),
    popularitySources: popularitySourcesOf(results),
    townVenuesWithoutFanData: {
      warning: runs.filter((run) => run.venueNoFanData === "warning").length,
      equalRanking: runs.filter((run) => run.venueNoFanData === "equal ranking")
        .length,
    },
    actsWithTownVenueWithoutFanData: acts.filter((act) => act.venueNoFanData)
      .length,
    actsWithTownVenueWithoutFanDataAtLift5: acts.filter(
      (act) =>
        act.venueNoFanData !== null &&
        act.localLift !== null &&
        act.localLift >= LOCAL_LIFT_BAR,
    ).length,
    barMet: complete ? all.atBar >= BAR_ACTS : null,
    productBar: complete ? productBar(all.atBar) : null,
  };
}
