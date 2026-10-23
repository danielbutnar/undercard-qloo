import { compareEndpoint } from "./compare";
import { createGet, type QlooClientOptions } from "./core";
import { entitiesEndpoint } from "./entities";
import { explainEndpoint } from "./explain";
import {
  artistsEndpoint,
  audienceEndpoint,
  placesEndpoint,
  rankAmongEndpoint,
} from "./insights";
import { searchEndpoint } from "./search";
import { tagsEndpoint } from "./tags";

/**
 * The Qloo client: one cached, retried GET (./core.ts) behind each endpoint this app calls,
 * one file per endpoint: /search, /entities, /v2/tags, /v2/insights (places, artists, a
 * shared audience, a shortlist's ranking and Qloo's split of each act's result) and
 * /v2/analysis/compare. The hackathon host only, GET only.
 */
export function createQlooClient(options: QlooClientOptions) {
  const get = createGet(options);
  return {
    search: searchEndpoint(get),
    images: entitiesEndpoint(get),
    tags: tagsEndpoint(get),
    places: placesEndpoint(get),
    artists: artistsEndpoint(get),
    audience: audienceEndpoint(get),
    rankAmong: rankAmongEndpoint(get),
    explain: explainEndpoint(get),
    compare: compareEndpoint(get),
  };
}

export type QlooClient = ReturnType<typeof createQlooClient>;
