import { z } from "zod";
import { RawEntity, toEntity, type QlooEntity, type QlooGet } from "./core";

const InsightsBody = z.object({
  results: z.object({ entities: z.array(RawEntity) }),
});

/**
 * Qloo's warnings on an Insights answer (docs/evidence.md section 35): a signal input it couldn't
 * use comes back as { type: "not_found", "signal.interests.entities": [<entity id>] }, and the
 * input is left out of the result. Read loosely: a warning in any other shape is ignored, never
 * an error.
 */
const Warnings = z
  .array(z.unknown())
  .catch([])
  .transform((warnings) =>
    warnings.flatMap((warning) => {
      if (!warning || typeof warning !== "object") return [];
      const record = warning as Record<string, unknown>;
      const ids = record["signal.interests.entities"];
      if (record.type !== "not_found" || !Array.isArray(ids)) return [];
      return ids.filter((id): id is string => typeof id === "string");
    }),
  );

const ScoredBody = InsightsBody.extend({ warnings: Warnings.optional() });

/** An artists read with what Qloo said it couldn't score (WS13 item 1). */
export interface ScoredArtists {
  /** The ranked artists, as the plain read returns them. */
  entities: QlooEntity[];
  /** Signal inputs Qloo reported not found, by entity id: it had no fan data to use for them. */
  unscored: string[];
}

export interface ArtistsQuery {
  signalEntityIds: string[];
  popularityMin: number;
  popularityMax: number;
  excludeEntityIds?: string[];
  /** Qloo age buckets for signal.demographics.age, such as 25_to_29. */
  ages?: readonly string[];
  take?: number;
}

/** The parameters of an artists ranking, in the order the trace lists them. */
function artistParams({
  signalEntityIds,
  popularityMin,
  popularityMax,
  excludeEntityIds = [],
  ages = [],
  take = 50,
}: ArtistsQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {
    "filter.type": "urn:entity:artist",
    "signal.interests.entities": signalEntityIds.join(","),
    "filter.popularity.min": popularityMin,
    "filter.popularity.max": popularityMax,
  };
  if (excludeEntityIds.length)
    params["filter.exclude.entities"] = excludeEntityIds.join(",");
  if (ages.length) params["signal.demographics.age"] = ages.join(",");
  params.take = take;
  return params;
}

/** GET /v2/insights with filter.type=urn:entity:place: a town's tagged places. */
export function placesEndpoint(get: QlooGet) {
  /** GET /v2/insights with filter.type=urn:entity:place: places in a locality with a tag. */
  return function places({
    locationQuery,
    tagId,
    take = 20,
  }: {
    locationQuery: string;
    tagId: string;
    take?: number;
  }) {
    return get(
      "/v2/insights",
      {
        "filter.type": "urn:entity:place",
        "filter.location.query": locationQuery,
        "filter.tags": tagId,
        take,
      },
      (body) => InsightsBody.parse(body).results.entities.map(toEntity),
      // M6o: places carry their keywords; answers cached before then don't.
      "k1:",
    );
  };
}

/** GET /v2/insights with filter.type=urn:entity:artist: the rankings a lineup is read from. */
export function artistsEndpoint(get: QlooGet) {
  /**
   * GET /v2/insights with filter.type=urn:entity:artist: artists ranked by affinity to the
   * signal entities, inside a popularity band. Artists have no location of their own in Qloo,
   * and its location data for them gave a usable local reading for at most 7 of the 10 acts
   * tested (docs/evidence.md section 6), so local taste enters only as venue entities in the
   * signal (SPEC.md section 7).
   */
  return function artists(query: ArtistsQuery) {
    return get("/v2/insights", artistParams(query), (body) =>
      InsightsBody.parse(body).results.entities.map(toEntity),
    );
  };
}

/** The same ranking with Qloo's not_found warnings kept (WS13 item 1: fan data first). */
export function scoredArtistsEndpoint(get: QlooGet) {
  /**
   * GET /v2/insights for artists, exactly as artists() asks it, keeping the signal inputs Qloo
   * reported not found: a venue among them is one Qloo had no fan data for. Cached under its own
   * key version, so it never reads or replaces a plain ranking's entry (whose warnings the cache
   * didn't keep).
   */
  return function scoredArtists(query: ArtistsQuery) {
    return get(
      "/v2/insights",
      artistParams(query),
      (body): ScoredArtists => {
        const parsed = ScoredBody.parse(body);
        return {
          entities: parsed.results.entities.map(toEntity),
          unscored: [...new Set(parsed.warnings ?? [])],
        };
      },
      "w1:",
      (data) => data.entities.length,
    );
  };
}

/** GET /v2/insights limited to given acts, for several signal entities (the shortlist, WS4). */
export function rankAmongEndpoint(get: QlooGet) {
  /**
   * GET /v2/insights for artists, with the results limited to the given acts: every act is
   * scored inside the same call, so their places can be compared (Qloo normalises scores per
   * query). The signal is the headliners, with one venue's fans or none, and the crowd's age.
   */
  return function rankAmong({
    signalEntityIds,
    amongIds,
    ages = [],
  }: {
    signalEntityIds: string[];
    amongIds: string[];
    /** Qloo age buckets for signal.demographics.age, such as 25_to_29. */
    ages?: readonly string[];
  }) {
    const params: Record<string, string | number> = {
      "filter.type": "urn:entity:artist",
      "signal.interests.entities": signalEntityIds.join(","),
      "filter.results.entities": amongIds.join(","),
    };
    if (ages.length) params["signal.demographics.age"] = ages.join(",");
    params.take = amongIds.length;
    return get("/v2/insights", params, (body) =>
      InsightsBody.parse(body).results.entities.map(toEntity),
    );
  };
}

/** GET /v2/insights limited to given acts: how much two acts share an audience (M8a). */
export function audienceEndpoint(get: QlooGet) {
  /**
   * GET /v2/insights for artists seeded by one act, with the results limited to the given acts
   * (M8a): each result's affinity is how much the seed's fans like that act, which scores how
   * much the two share an audience.
   */
  return function audience({
    seedId,
    amongIds,
  }: {
    seedId: string;
    amongIds: string[];
  }) {
    return get(
      "/v2/insights",
      {
        "filter.type": "urn:entity:artist",
        "signal.interests.entities": seedId,
        "filter.results.entities": amongIds.join(","),
        take: amongIds.length,
      },
      (body) => InsightsBody.parse(body).results.entities.map(toEntity),
    );
  };
}
