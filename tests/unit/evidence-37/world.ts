// A synthetic world for section 37's run: three invented towns in two countries, their music
// rooms, three saved builds and a Qloo that answers like Qloo's shapes. Invented names and ids
// only; no Qloo response data.
import type { CheckedTown } from "@/lib/checked-towns";
import type { FeeBandId } from "@/lib/fee-bands";
import { checkedFestival } from "@/lib/towns";
import type { SavedBuild } from "@/server/build-store";

export const TAG = "urn:tag:genre:place:live_music_venue";
export const HEADLINERS = ["h-1", "h-2"] as const;
export const AGES = ["25_to_29", "30_to_34"] as const;

// Sorted, their control towns are: Alder -> Birch, Birch -> Cedar, Cedar -> Birch.
export const TOWNS: CheckedTown[] = [
  { city: "Alder", region: "Alpha", country: "Alpha" },
  { city: "Birch", region: "Beta", country: "Beta" },
  { city: "Cedar", region: "Alpha", country: "Alpha" },
];

interface WorldRoom {
  id: string;
  name: string;
  popularity?: number;
}

/** Each town's music rooms as its find_venues answer lists them. Alder's answer lacks Alder Hall. */
export const ROOMS: Record<string, WorldRoom[]> = {
  Alder: [
    { id: "v-a2", name: "Alder Club", popularity: 0.7 },
    { id: "v-a3", name: "Alder Park", popularity: 0.3 },
  ],
  Birch: [
    { id: "v-b1", name: "Birch Bar", popularity: 0.69 },
    { id: "v-b2", name: "Birch Cellar", popularity: 0.72 },
    { id: "v-b3", name: "Birch Dome", popularity: 0.4 },
    { id: "v-b4", name: "Birch Loft", popularity: 0.52 },
    { id: "v-b5", name: "Birch Shed" },
  ],
  Cedar: [
    { id: "v-c1", name: "Cedar Room", popularity: 0.6 },
    { id: "v-c2", name: "Cedar Yard", popularity: 0.65 },
  ],
};

/** Places only /entities knows the popularity of. */
export const ENTITY_ROOMS: Record<string, WorldRoom> = {
  "v-a1": { id: "v-a1", name: "Alder Hall", popularity: 0.5 },
};

const room = (id: string) =>
  Object.values(ROOMS)
    .flat()
    .concat(Object.values(ENTITY_ROOMS))
    .find((entry) => entry.id === id)!;

/** Qloo has no fan data for these: their rankings are the headliners' own, with a warning. */
export const DEFAULT_UNSCORED = ["v-b1"];

const base = (band: FeeBandId) =>
  Array.from(
    { length: 60 },
    (_, index) =>
      `${band === "mid" ? "m" : "o"}${String(index + 1).padStart(2, "0")}`,
  );

/** With an input's fans added, these acts lead the band's ranking, the rest following. */
const LEADS: Record<string, Partial<Record<FeeBandId, string[]>>> = {
  "v-a2": { mid: ["m20", "m01"], opener: ["o15"] },
  "v-a1": { mid: ["m30"] },
  "v-b2": {
    mid: ["m40", "m01", "m02", "m03", "m04", "m05", "m06", "m07", "m20"],
    opener: ["o01", "o02", "o15"],
  },
  "v-b4": { mid: ["m01", "m02", "m03", "m04", "m30"] },
};
/** With an input's fans added, these acts drop out of the band's top 50. */
const DROPS: Record<string, Partial<Record<FeeBandId, string[]>>> = {
  "v-c1": { opener: ["o25"] },
};

function ranking(input: string | null, band: FeeBandId): string[] {
  const lead = (input && LEADS[input]?.[band]) || [];
  const drop = (input && DROPS[input]?.[band]) || [];
  return [
    ...lead,
    ...base(band).filter((id) => !lead.includes(id) && !drop.includes(id)),
  ];
}

/** A Qloo answer for a GET, by its path and parameters. */
export function answerFor(
  path: string,
  params: Record<string, string>,
  unscored: readonly string[] = DEFAULT_UNSCORED,
  /** false: /entities knows no popularity. quiet: inputs ignored with no warning. */
  {
    entities = true,
    quiet = [],
  }: { entities?: boolean; quiet?: readonly string[] } = {},
): unknown {
  if (path === "/v2/insights" && params["filter.type"] === "urn:entity:place")
    return {
      success: true,
      results: {
        entities: (ROOMS[params["filter.location.query"]] ?? []).map(
          (entry) => ({
            entity_id: entry.id,
            name: entry.name,
            types: ["urn:entity:place"],
            ...(entry.popularity === undefined
              ? {}
              : { popularity: entry.popularity }),
          }),
        ),
      },
    };
  if (
    path === "/v2/insights" &&
    params["filter.type"] === "urn:entity:artist"
  ) {
    const band: FeeBandId =
      Number(params["filter.popularity.min"]) >= 0.8 ? "mid" : "opener";
    const input =
      params["signal.interests.entities"].split(",")[HEADLINERS.length] ?? null;
    const blind = input !== null && unscored.includes(input);
    return {
      success: true,
      results: {
        entities: ranking(
          blind || (input !== null && quiet.includes(input)) ? null : input,
          band,
        )
          .slice(0, Number(params.take))
          .map((id) => ({ entity_id: id, name: `Act ${id}` })),
      },
      ...(blind
        ? {
            warnings: [
              { type: "not_found", "signal.interests.entities": [input] },
            ],
          }
        : {}),
    };
  }
  if (path === "/entities")
    return {
      success: true,
      results: params.entity_ids
        .split(",")
        .flatMap((id) =>
          entities && ENTITY_ROOMS[id] ? [ENTITY_ROOMS[id]] : [],
        )
        .map((entry) => ({
          entity_id: entry.id,
          name: entry.name,
          popularity: entry.popularity,
        })),
    };
  throw new Error(`the synthetic Qloo has no answer for ${path}`);
}

const keyOf = (path: string, params: Record<string, string | number>) =>
  `${path}?${new URLSearchParams(
    Object.entries(params)
      .map(([key, value]): [string, string] => [key, String(value)])
      .sort(),
  )}`;

/** An ask that answers each distinct call once, as the run's memory does, and counts the calls. */
export function memoAsk(
  unscored: readonly string[] = DEFAULT_UNSCORED,
  options: { entities?: boolean; quiet?: readonly string[] } = {},
) {
  const memory = new Map<string, unknown>();
  const calls: { path: string; params: Record<string, string> }[] = [];
  const ask = async (path: string, params: Record<string, string | number>) => {
    const key = keyOf(path, params);
    if (!memory.has(key)) {
      const flat = Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      );
      calls.push({ path, params: flat });
      memory.set(key, answerFor(path, flat, unscored, options));
    }
    return memory.get(key);
  };
  return { ask, calls };
}

/** A fetch over the same world, recording each request; `route` may answer first. */
export function worldFetch(
  route: (url: URL, n: number) => Response | undefined = () => undefined,
  unscored: readonly string[] = DEFAULT_UNSCORED,
) {
  const requests: URL[] = [];
  const fetch = async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    const early = route(url, requests.length);
    if (early) return early;
    return new Response(
      JSON.stringify(
        answerFor(url.pathname, Object.fromEntries(url.searchParams), unscored),
      ),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  return { fetch: fetch as typeof globalThis.fetch, requests };
}

type ActSpec = [entityId: string, band: FeeBandId, venueId: string];

function buildFor(
  town: CheckedTown,
  anchors: Partial<Record<FeeBandId, string[]>>,
  acts: ActSpec[],
): SavedBuild {
  const festival = checkedFestival(town);
  const venue = (id: string) => ({ entityId: id, name: room(id).name });
  return {
    id: `build-${town.city.toLowerCase()}`,
    festivalId: festival.id,
    createdAt: "2026-10-17T20:00:00.000Z",
    trace: [
      {
        n: 1,
        tool: "find_venues",
        endpoint: "/v2/insights",
        summary: `${town.city} places tagged Live music venue`,
        params: [
          { key: "filter.type", value: "urn:entity:place" },
          { key: "filter.location.query", value: town.city },
          { key: "filter.tags", value: TAG },
          { key: "take", value: "20" },
        ],
        resultCount: ROOMS[town.city].length,
        ms: 1,
        cached: false,
      },
    ],
    lineup: {
      festivalId: festival.id,
      acts: acts.map(([entityId, band, venueId]) => ({
        entityId,
        name: `Act ${entityId}`,
        band,
        affinity: 0.5,
        popularity: band === "mid" ? 0.85 : 0.6,
        anchorVenue: venue(venueId),
        reason: `${room(venueId).name} fans move it up.`,
        sharedTags: [
          { id: "urn:tag:genre:music:one", name: "One" },
          { id: "urn:tag:genre:music:two", name: "Two" },
        ],
      })),
    },
    context: {
      headliners: HEADLINERS.map((entityId, index) => ({
        entityId,
        name: `Headliner ${index + 1}`,
        tags: [],
      })),
      comparedTags: [],
      baselines: {},
      anchors: Object.fromEntries(
        Object.entries(anchors).map(([band, ids]) => [band, ids.map(venue)]),
      ),
      ages: [...AGES],
    },
  };
}

/** Alder's build reads Alder Club in both tiers and Alder Hall for the mid tier. */
export const BUILDS: SavedBuild[] = [
  buildFor(TOWNS[0], { mid: ["v-a2", "v-a1"], opener: ["v-a2"] }, [
    ["m20", "mid", "v-a2"],
    ["m30", "mid", "v-a1"],
    ["o15", "opener", "v-a2"],
  ]),
  buildFor(TOWNS[1], { mid: ["v-b2"] }, [["m40", "mid", "v-b2"]]),
  buildFor(TOWNS[2], { opener: ["v-c1"] }, [["o25", "opener", "v-c1"]]),
];

/** Each festival with its town, brief and saved build, in the towns' order. */
export const FESTIVALS = TOWNS.map((town, index) => ({
  town,
  festival: checkedFestival(town),
  build: BUILDS[index],
}));
