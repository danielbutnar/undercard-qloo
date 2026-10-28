import { compareEndpoint } from "./compare";
import { createGet, QLOO_CACHE_PREFIX, type QlooClientOptions } from "./core";
import { entitiesEndpoint } from "./entities";
import { explainEndpoint } from "./explain";
import {
  artistsEndpoint,
  audienceEndpoint,
  placesEndpoint,
  rankAmongEndpoint,
  scoredArtistsEndpoint,
} from "./insights";
import { searchEndpoint } from "./search";
import { tagsEndpoint } from "./tags";

/**
 * The Qloo client: one cached, retried GET (./core.ts) behind each endpoint this app calls,
 * one file per endpoint: /search, /entities, /v2/tags, /v2/insights (places, artists, a
 * shared audience, a shortlist's ranking and Qloo's split of each act's result) and
 * /v2/analysis/compare. The hackathon host only, GET only.
 */
export function createQlooClient(options: QlooClientOptions): QlooClient {
  const get = createGet(options);
  return {
    search: searchEndpoint(get),
    images: entitiesEndpoint(get),
    tags: tagsEndpoint(get),
    places: placesEndpoint(get),
    artists: artistsEndpoint(get),
    scoredArtists: scoredArtistsEndpoint(get),
    audience: audienceEndpoint(get),
    rankAmong: rankAmongEndpoint(get),
    explain: explainEndpoint(get),
    compare: compareEndpoint(get),
    cachePrefix: options.prefix ?? QLOO_CACHE_PREFIX,
    // The same client over another prefix (WS13): a saved build's replay reads the one it records.
    withPrefix: (prefix: string) => createQlooClient({ ...options, prefix }),
  };
}

export interface QlooClient {
  search: ReturnType<typeof searchEndpoint>;
  images: ReturnType<typeof entitiesEndpoint>;
  tags: ReturnType<typeof tagsEndpoint>;
  places: ReturnType<typeof placesEndpoint>;
  artists: ReturnType<typeof artistsEndpoint>;
  scoredArtists: ReturnType<typeof scoredArtistsEndpoint>;
  audience: ReturnType<typeof audienceEndpoint>;
  rankAmong: ReturnType<typeof rankAmongEndpoint>;
  explain: ReturnType<typeof explainEndpoint>;
  compare: ReturnType<typeof compareEndpoint>;
  /** The cache prefix this client reads and writes under. */
  cachePrefix: string;
  /** The same client over another prefix (a saved build's replay reads the one it records). */
  withPrefix(prefix: string): QlooClient;
}
