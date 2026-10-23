import { z } from "zod";
import { RawEntity, toEntity, type QlooGet } from "./core";

const InsightsBody = z.object({
  results: z.object({ entities: z.array(RawEntity) }),
});

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
  return function artists({
    signalEntityIds,
    popularityMin,
    popularityMax,
    excludeEntityIds = [],
    ages = [],
    take = 50,
  }: {
    signalEntityIds: string[];
    popularityMin: number;
    popularityMax: number;
    excludeEntityIds?: string[];
    /** Qloo age buckets for signal.demographics.age, such as 25_to_29. */
    ages?: readonly string[];
    take?: number;
  }) {
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
    return get("/v2/insights", params, (body) =>
      InsightsBody.parse(body).results.entities.map(toEntity),
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
