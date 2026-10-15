import { z } from "zod";
import type { QlooCache } from "./qloo-cache";

/** The hackathon key works only against this host (RULES.md, Dev guide). */
export const QLOO_BASE_URL = "https://hackathon.api.qloo.com";
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const REQUEST_TIMEOUT_MS = 20_000;

/** The only Qloo endpoints this app calls, all with GET and parameters in the query string. */
type QlooPath =
  "/search" | "/v2/tags" | "/v2/insights" | "/v2/analysis/compare";

export interface QlooTag {
  id: string;
  name: string;
  type: string;
}

export interface QlooEntity {
  entityId: string;
  name: string;
  popularity: number;
  /** query.affinity on Insights results; null where Qloo returns none (search, places). */
  affinity: number | null;
  tags: QlooTag[];
}

export interface QlooCall {
  path: QlooPath;
  params: [key: string, value: string][];
  resultCount: number;
  ms: number;
  cached: boolean;
}

export interface QlooResult<T> {
  data: T;
  call: QlooCall;
}

export class QlooError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

// Response shapes, loose on purpose: only the fields the app reads are checked. /search and
// /v2/analysis/compare name a tag's id `tag_id`; Insights and /v2/tags may name it `id`.
// Qloo occasionally returns a tag with neither id nor name; such tags are dropped.
const RawTag = z.object({
  id: z.string().optional(),
  tag_id: z.string().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  subtype: z.string().optional(),
});
const RawEntity = z.object({
  entity_id: z.string(),
  name: z.string(),
  popularity: z.number().optional(),
  query: z.object({ affinity: z.number().optional() }).partial().optional(),
  tags: z.array(RawTag).optional(),
});
const SearchBody = z.object({ results: z.array(RawEntity) });
const InsightsBody = z.object({
  results: z.object({ entities: z.array(RawEntity) }),
});
const TagsBody = z.object({ results: z.object({ tags: z.array(RawTag) }) });
const CompareBody = z.object({
  results: z.object({
    tags: z.array(
      RawTag.extend({
        query: z.object({ score: z.number().optional() }).partial().optional(),
      }),
    ),
  }),
});

function toTag(raw: z.infer<typeof RawTag>): QlooTag {
  return {
    id: raw.id ?? raw.tag_id ?? "",
    name: raw.name ?? "",
    type: raw.type ?? raw.subtype ?? "",
  };
}

const usable = (tag: QlooTag) => tag.id !== "" && tag.name !== "";

function toEntity(raw: z.infer<typeof RawEntity>): QlooEntity {
  return {
    entityId: raw.entity_id,
    name: raw.name,
    popularity: raw.popularity ?? 0,
    affinity: raw.query?.affinity ?? null,
    tags: (raw.tags ?? []).map(toTag).filter(usable),
  };
}

export interface QlooClientOptions {
  apiKey: string;
  cache: QlooCache;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export type QlooClient = ReturnType<typeof createQlooClient>;

export function createQlooClient({
  apiKey,
  cache,
  baseUrl = QLOO_BASE_URL,
  fetch = globalThis.fetch,
}: QlooClientOptions) {
  // Every result is a list, so its length is the result count the trace shows.
  async function get<T extends unknown[]>(
    path: QlooPath,
    params: Record<string, string | number>,
    parse: (body: unknown) => T,
  ): Promise<QlooResult<T>> {
    const entries = Object.entries(params).map(
      ([key, value]): [string, string] => [key, String(value)],
    );
    const cacheKey = `qloo:v1:${path}?${new URLSearchParams([...entries].sort()).toString()}`;
    const started = Date.now();
    const call = (data: T, cached: boolean): QlooCall => ({
      path,
      params: entries,
      resultCount: data.length,
      ms: Date.now() - started,
      cached,
    });

    const hit = await cache.get<T>(cacheKey);
    if (hit !== null) return { data: hit, call: call(hit, true) };

    const url = new URL(path, baseUrl);
    for (const [key, value] of entries) url.searchParams.set(key, value);
    const response = await fetch(url, {
      method: "GET",
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new QlooError(
        response.status,
        `Qloo ${path} answered HTTP ${response.status}`,
      );
    }

    const data = parse(await response.json());
    await cache.set(cacheKey, data, CACHE_TTL_SECONDS);
    return { data, call: call(data, false) };
  }

  return {
    /** GET /search: entities by name. */
    search({
      query,
      types = "urn:entity:artist",
      take = 5,
    }: {
      query: string;
      types?: string;
      take?: number;
    }) {
      return get("/search", { query, types, take }, (body) =>
        SearchBody.parse(body).results.map(toEntity),
      );
    },

    /** GET /v2/tags: tag ids by keyword. */
    tags({
      query,
      parentType,
      take = 10,
    }: {
      query: string;
      parentType?: string;
      take?: number;
    }) {
      const params: Record<string, string | number> = { "filter.query": query };
      if (parentType) params["filter.parents.types"] = parentType;
      params.take = take;
      return get("/v2/tags", params, (body) =>
        TagsBody.parse(body).results.tags.map(toTag).filter(usable),
      );
    },

    /** GET /v2/insights with filter.type=urn:entity:place: places in a locality with a tag. */
    places({
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
      );
    },

    /**
     * GET /v2/insights with filter.type=urn:entity:artist: artists ranked by affinity to the
     * signal entities, inside a popularity band. Artists take no location parameter, so local
     * taste enters only as venue entities in the signal (SPEC.md section 7).
     */
    artists({
      signalEntityIds,
      popularityMin,
      popularityMax,
      excludeEntityIds = [],
      take = 50,
    }: {
      signalEntityIds: string[];
      popularityMin: number;
      popularityMax: number;
      excludeEntityIds?: string[];
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
      params.take = take;
      return get("/v2/insights", params, (body) =>
        InsightsBody.parse(body).results.entities.map(toEntity),
      );
    },

    /** GET /v2/analysis/compare: the tags two groups of entities have in common, with scores. */
    compare({ a, b, take = 25 }: { a: string[]; b: string[]; take?: number }) {
      return get(
        "/v2/analysis/compare",
        {
          "a.signal.interests.entities": a.join(","),
          "b.signal.interests.entities": b.join(","),
          take,
        },
        (body) =>
          CompareBody.parse(body)
            .results.tags.map((raw) => ({
              tag: toTag(raw),
              score: raw.query?.score ?? 0,
            }))
            .filter(({ tag }) => usable(tag)),
      );
    },
  };
}
