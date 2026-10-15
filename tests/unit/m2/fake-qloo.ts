// Synthetic stand-ins for the Qloo API: response bodies shaped like Qloo's, with invented
// names and reserved all-zero ids. No real Qloo response data is used in tests.

export const syntheticId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export interface RecordedRequest {
  url: URL;
  init: RequestInit | undefined;
}

/** A fetch that answers from `route` and records every request it receives. */
export function fakeFetch(route: (url: URL) => unknown) {
  const requests: RecordedRequest[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    const body = route(url);
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch: fetch as typeof globalThis.fetch, requests };
}

export const params = (url: URL) => Object.fromEntries(url.searchParams);

type TagSpec = [type: string, slug: string, name: string];

const genre = (slug: string, name: string): TagSpec => [
  "urn:tag:genre:music",
  slug,
  name,
];

export const HEADLINER_TAGS: TagSpec[] = [
  genre("dream_pop", "Dream Pop"),
  genre("indie_rock", "Indie Rock"),
  genre("psychedelic_rock", "Psychedelic Rock"),
  genre("funk", "Funk"),
];

/** A /search result item, with tags in the /search shape ({tag_id, name, type, value}). */
export function searchEntity(
  n: number,
  name: string,
  popularity: number,
  tags = HEADLINER_TAGS,
) {
  return {
    name,
    entity_id: syntheticId(n),
    types: ["urn:entity:artist"],
    popularity,
    tags: tags.map(([, slug, tagName]) => ({
      tag_id: `urn:tag:genre:${slug}`,
      name: tagName,
      type: "urn:tag:genre",
      value: `urn:tag:genre:${slug}`,
    })),
  };
}

/** An /v2/insights entity, with tags in the Insights shape ({id, name, type}). */
export function insightsEntity(
  n: number,
  name: string,
  popularity: number,
  affinity: number,
  tags: TagSpec[] = HEADLINER_TAGS.slice(0, 2),
) {
  return {
    name,
    entity_id: syntheticId(n),
    types: ["urn:entity:artist"],
    popularity,
    query: { affinity },
    tags: tags.map(([type, slug, tagName]) => ({
      id: `${type}:${slug}`,
      name: tagName,
      type,
    })),
  };
}

export const insightsBody = (entities: unknown[]) => ({
  success: true,
  results: { entities },
});
