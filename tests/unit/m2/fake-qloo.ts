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

export const VENUES = [
  { n: 201, name: "The Lantern Room", kind: "Live music venue" },
  { n: 202, name: "Fort Street Ballroom", kind: "Live music venue" },
  { n: 203, name: "Sagebrush Diner", kind: "Restaurant" },
] as const;

/**
 * WS13 item 1: a music room Qloo has no fan data for. Its answers carry Qloo's not_found warning
 * (the shape section 35's raw answers show) and rank the headliners' own list, score for score.
 */
export const NO_FAN_DATA_VENUE = {
  n: 204,
  name: "Larkspur Music Hall",
  kind: "Live music venue",
} as const;

/** The invented town whose venue list holds it, second, between two rooms with fan data. */
export const LARKSPUR = "Larkspur";
const LARKSPUR_VENUES = [VENUES[0], NO_FAN_DATA_VENUE, VENUES[1], VENUES[2]];

const BAND_SPECS = {
  mid: { min: 0.8, span: 0.12, base: 1000, label: "Mid" },
  opener: { min: 0.55, span: 0.24, base: 2000, label: "Opener" },
} as const;

const LIST_LENGTH = 50;

/** The headliners-only ranking for a band: 50 synthetic acts, strongest affinity first. */
function baselineFor(band: keyof typeof BAND_SPECS) {
  const spec = BAND_SPECS[band];
  return Array.from({ length: LIST_LENGTH }, (_, rank) => {
    // Every tenth act shares only one tag with the headliners, so assembly must skip it.
    const tags =
      rank % 10 === 0
        ? HEADLINER_TAGS.slice(0, 1)
        : HEADLINER_TAGS.slice(rank % 3, (rank % 3) + 2);
    return {
      rank,
      entity: (affinity: number) =>
        insightsEntity(
          spec.base + rank,
          `${spec.label} Act ${String(rank + 1).padStart(2, "0")}`,
          spec.min + (spec.span * (LIST_LENGTH - 1 - rank)) / LIST_LENGTH,
          affinity,
          tags,
        ),
    };
  });
}

/**
 * A venue re-ranks the baseline: The Lantern Room reverses it, Fort Street Ballroom rotates it
 * by 20 places, and Sagebrush Diner leaves it unchanged (a venue with no signal).
 */
function venueOrder(venueN: number, ranks: number[]) {
  if (venueN === 201) return [...ranks].reverse();
  if (venueN === 202) return [...ranks.slice(20), ...ranks.slice(0, 20)];
  return ranks;
}

/** A synthetic Qloo API for the agent: the headliners, Boise venues, tags and artist lists. */
export function syntheticQloo(url: URL): unknown {
  const p = params(url);
  if (url.pathname === "/search") {
    const names: Record<string, number> = {
      khruangbin: 1,
      "japanese breakfast": 2,
    };
    const n = names[(p.query ?? "").toLowerCase()];
    return { results: n ? [searchEntity(n, p.query, 0.99)] : [] };
  }
  if (url.pathname === "/v2/tags") {
    return {
      results: {
        tags: [
          {
            id: "urn:tag:genre:place:live_music_venue",
            name: "Live music venue",
          },
        ],
      },
    };
  }
  if (url.pathname === "/v2/analysis/compare") {
    return {
      results: {
        tags: [
          {
            tag_id: "urn:tag:genre:music:dream_pop",
            name: "Dream Pop",
            subtype: "urn:tag:genre:music",
            query: { score: 0.9 },
          },
        ],
        a: [],
        b: [],
      },
    };
  }
  if (
    url.pathname === "/v2/insights" &&
    p["filter.type"] === "urn:entity:place"
  ) {
    const listed =
      p["filter.location.query"] === LARKSPUR ? LARKSPUR_VENUES : VENUES;
    return insightsBody(
      listed.map((venue) => ({
        name: venue.name,
        entity_id: syntheticId(venue.n),
        types: ["urn:entity:place"],
        popularity: 0.7,
        tags: [
          {
            id: `urn:tag:category:place:${venue.kind.toLowerCase().replace(/ /g, "_")}`,
            name: venue.kind,
            type: "urn:tag:category:place",
          },
        ],
      })),
    );
  }
  // WS13.4: given acts among themselves (filter.results.entities). The headliners alone score
  // every act; with Qloo's location signal it answers every other one, a little higher.
  if (
    url.pathname === "/v2/insights" &&
    p["filter.type"] === "urn:entity:artist" &&
    p["filter.results.entities"]
  ) {
    const located = p["signal.location.query"] !== undefined;
    return insightsBody(
      p["filter.results.entities"].split(",").flatMap((id, k) => {
        if (located && k % 2 === 1) return [];
        const n = Number(id.slice(-12));
        const affinity = (located ? 0.92 : 0.86) - k * 0.01;
        return [insightsEntity(n, `Act ${n}`, 0.8, affinity)];
      }),
    );
  }
  if (
    url.pathname === "/v2/insights" &&
    p["filter.type"] === "urn:entity:artist"
  ) {
    const band = Number(p["filter.popularity.min"]) >= 0.8 ? "mid" : "opener";
    const signal = (p["signal.interests.entities"] ?? "").split(",");
    const venueN = signal[2] ? Number(signal[2].slice(-12)) : null;
    const baseline = baselineFor(band);
    const order =
      venueN === null
        ? baseline.map((row) => row.rank)
        : venueOrder(
            venueN,
            baseline.map((row) => row.rank),
          );
    const body = insightsBody(
      order.map((rank, position) =>
        baseline[rank].entity(0.95 - position * 0.001),
      ),
    );
    // Qloo leaves a venue it has no fan data for out of the signal, and says so.
    return venueN === NO_FAN_DATA_VENUE.n
      ? {
          ...body,
          warnings: [
            {
              type: "not_found",
              "signal.interests.entities": [syntheticId(NO_FAN_DATA_VENUE.n)],
            },
          ],
        }
      : body;
  }
  return new Response("{}", { status: 404 });
}
