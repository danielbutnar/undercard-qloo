// An invented world for the buyer's shortlist (WS4): a saved build's context, what Qloo's search
// answers for the names a buyer pastes, and a fake fetch that records every request. Invented
// names and reserved all-zero ids, shaped like Qloo's answers; no Qloo response data.
import type { SavedBuild } from "@/server/build-store";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import {
  fakeFetch,
  insightsBody,
  insightsEntity,
  params,
  searchEntity,
  syntheticId as id,
} from "../m2/fake-qloo";

type Genre = [type: string, slug: string, name: string];
const genre = (slug: string, name: string): Genre => [
  "urn:tag:genre:music",
  `music:${slug}`,
  name,
];
export const PSYCH = genre("psychedelic_rock", "Psychedelic Rock");
export const DREAM = genre("dream_pop", "Dream Pop");
export const INDIE = genre("indie_pop", "Indie Pop");
export const FUNK = genre("funk", "Funk");

export const HEADLINERS = [
  { n: 1, name: "Khruangbin" },
  { n: 2, name: "Japanese Breakfast" },
];
export const LANTERN = { entityId: id(201), name: "The Lantern Room" };
export const FORT = { entityId: id(202), name: "Fort Street Ballroom" };
export const COTTONWOOD = { entityId: id(203), name: "Cottonwood Social Hall" };

/** The invented acts search can find, by entity number: name, popularity and genres. */
export const ARTISTS: Record<
  number,
  { name: string; popularity: number; genres: Genre[] }
> = {
  301: { name: "Velvet Coyote", popularity: 0.963, genres: [PSYCH, INDIE] },
  302: { name: "Long Drives", popularity: 0.941, genres: [DREAM] },
  303: { name: "Marigold Static", popularity: 0.862, genres: [DREAM, INDIE] },
  304: { name: "Paper Canyon", popularity: 0.975, genres: [FUNK] },
  305: { name: "Dusk Arcade", popularity: 0.912, genres: [INDIE, DREAM] },
  306: { name: "Honey Basin", popularity: 0.958, genres: [PSYCH, DREAM] },
  307: { name: "Lowland Choir", popularity: 0.64, genres: [INDIE] },
  308: { name: "Silver Mesa", popularity: 0.47, genres: [PSYCH] },
  309: { name: "Fjärilsdal (band)", popularity: 0.81, genres: [DREAM, PSYCH] },
  399: { name: "Long Drives Tribute Band", popularity: 0.3, genres: [] },
  904: { name: "Nobody Knows", popularity: 0.6, genres: [INDIE] },
};

const found = (...ns: number[]) =>
  ns.map((n) =>
    searchEntity(n, ARTISTS[n].name, ARTISTS[n].popularity, ARTISTS[n].genres),
  );

/** What /search answers for each name, as typed; any other name finds nothing. */
export const SEARCHES: Record<string, unknown[]> = {
  "Velvet Coyote": found(301),
  // The top result isn't the act: the second is, once a leading "The" is dropped.
  "The Long Drives": found(399, 302),
  "Long Drives": found(302),
  "Marigold Static": found(303),
  "Paper Canyon": found(304),
  "Dusk Arcade": found(305),
  "Honey Basin": found(306),
  "Lowland Choir": found(307),
  "Silver Mesa": found(308),
  // Accents and a bracketed note don't stop a match.
  Fjarilsdal: found(309),
  // A near miss is not a match: the name is not found, never guessed.
  "Nobody Knows Us": found(904),
  Khruangbin: [searchEntity(1, "Khruangbin", 0.99, [PSYCH])],
};

/** The saved build whose context the shortlist reads: the headliners, venues, crowd age. */
export function savedBuild(): SavedBuild {
  const venueRun = (n: number, band: "Mid" | "Opener", venue: string) => ({
    n,
    tool: "venue_artists",
    endpoint: "/v2/insights",
    summary: `${band}-band artists for the headliners and ${venue}`,
    params: [],
    resultCount: 50,
    ms: 1000,
    cached: false,
  });
  return {
    id: "shortlist-build",
    festivalId: "sagebrush-sound",
    createdAt: "2026-10-15T14:02:00.000Z",
    trace: [
      venueRun(1, "Mid", LANTERN.name),
      venueRun(2, "Opener", LANTERN.name),
      venueRun(3, "Mid", FORT.name),
      venueRun(4, "Opener", FORT.name),
      venueRun(5, "Mid", COTTONWOOD.name),
    ],
    lineup: {
      festivalId: "sagebrush-sound",
      acts: [
        {
          entityId: id(701),
          name: "Booked Act",
          band: "mid",
          affinity: 0.9,
          popularity: 0.85,
          anchorVenue: LANTERN,
          reason: `${LANTERN.name} fans move it up 9 places.`,
          sharedTags: [
            { id: "urn:tag:genre:music:dream_pop", name: "Dream Pop" },
            { id: "urn:tag:genre:music:indie_pop", name: "Indie Pop" },
          ],
        },
      ],
    },
    context: {
      headliners: HEADLINERS.map(({ n, name }) => ({
        entityId: id(n),
        name,
        tags: (n === 1 ? [PSYCH] : [DREAM]).map(([type, slug, tagName]) => ({
          id: `urn:tag:genre:${slug}`,
          name: tagName,
          type,
        })),
      })),
      comparedTags: [{ name: "Indie Pop", score: 0.8 }],
      baselines: {},
      anchors: { mid: [LANTERN, FORT, COTTONWOOD], opener: [LANTERN, FORT] },
      ages: ["25_to_29", "30_to_34"],
    },
  };
}

/** A Qloo client on a fresh memory cache whose fetch answers `route` and records requests. */
export function qlooWorld(
  route: (url: URL) => unknown,
  cache: QlooCache = createMemoryCache(),
) {
  const fake = fakeFetch(route);
  const live = createQlooClient({
    apiKey: "test-key",
    cache,
    fetch: fake.fetch,
  });
  const cached = createQlooClient({
    apiKey: "",
    cache,
    cacheOnly: true,
    fetch: async () => {
      throw new Error("a cache-only client never fetches");
    },
  });
  return { cache, live, cached, requests: fake.requests };
}

/** Search answers from SEARCHES; anything else is a 404. */
export function searchOnly(url: URL): unknown {
  if (url.pathname === "/search")
    return { results: SEARCHES[params(url).query] ?? [] };
  return new Response("{}", { status: 404 });
}

/**
 * Invented Qloo scores for each act: for the headliners alone and with each venue's fans added.
 * Qloo normalises each answer, so The Lantern Room's scores sit lower across the board, yet
 * Marigold Static rises from 6th to 1st in it. Cottonwood Social Hall's answer is the
 * headliners' own (a venue Qloo has no fan data for).
 */
export const SCORES: Record<
  number,
  { alone: number; lantern: number; fort: number }
> = {
  301: { alone: 0.95, lantern: 0.74, fort: 0.93 },
  302: { alone: 0.91, lantern: 0.68, fort: 0.89 },
  303: { alone: 0.85, lantern: 0.8, fort: 0.84 },
  304: { alone: 0.87, lantern: 0.62, fort: 0.91 },
  305: { alone: 0.89, lantern: 0.66, fort: 0.96 },
  306: { alone: 0.93, lantern: 0.7, fort: 0.92 },
  307: { alone: 0.81, lantern: 0.72, fort: 0.82 },
  308: { alone: 0.83, lantern: 0.6, fort: 0.86 },
};

/** Searches from SEARCHES, and insights limited to the listed acts, scored from `scores`. */
export function shortlistQloo(scores = SCORES) {
  return (url: URL): unknown => {
    if (url.pathname === "/search") return searchOnly(url);
    if (url.pathname !== "/v2/insights")
      return new Response("{}", { status: 404 });
    const p = params(url);
    const venue = (p["signal.interests.entities"] ?? "").split(",")[2];
    const column =
      venue === LANTERN.entityId
        ? "lantern"
        : venue === FORT.entityId
          ? "fort"
          : "alone";
    const entities = (p["filter.results.entities"] ?? "")
      .split(",")
      .map((entityId) => Number(entityId.slice(-12)))
      .filter((n) => scores[n] && ARTISTS[n])
      .map((n) =>
        insightsEntity(
          n,
          ARTISTS[n].name,
          ARTISTS[n].popularity,
          scores[n][column],
          ARTISTS[n].genres,
        ),
      )
      // Qloo answers strongest first.
      .sort((a, b) => b.query.affinity - a.query.affinity);
    return insightsBody(entities);
  };
}

export { fakeFetch, id, params };
