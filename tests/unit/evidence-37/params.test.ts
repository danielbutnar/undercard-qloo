import { describe, expect, it } from "vitest";
import { CHECKED_TOWNS, type CheckedTown } from "@/lib/checked-towns";
import type { QlooGet, QlooPath } from "@/lib/qloo/core";
import { entitiesEndpoint } from "@/lib/qloo/entities";
import { artistsEndpoint, placesEndpoint } from "@/lib/qloo/insights";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { checkedFestival } from "@/lib/towns";
import { createToolbox } from "@/server/agent-tools";
import {
  controlTownOf,
  entitiesParams,
  findVenues,
  placesParams,
  rankingParams,
  unscoredInputs,
  venueTagOf,
} from "@/server/control-test-37";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { BUILDS, TAG } from "./world";

/** The parameters one of the app's own endpoints sends, in its order. */
async function sent(call: (get: QlooGet) => Promise<unknown>) {
  const seen: { path: QlooPath; params: Record<string, string | number> }[] =
    [];
  const get = (async (
    path: QlooPath,
    params: Record<string, string | number>,
  ) => {
    seen.push({ path, params });
    return {
      data: [],
      call: { path, params: [], resultCount: 0, ms: 0, cached: true },
    };
  }) as unknown as QlooGet;
  await call(get);
  return { path: seen[0].path, params: Object.entries(seen[0].params) };
}

const mid = SAGEBRUSH_SOUND.feeBands.find((band) => band.id === "mid")!;

describe("the run's calls are the agent's own", () => {
  it("a ranking with a venue: venue_artists' parameters, in the same order", async () => {
    expect({
      path: "/v2/insights",
      params: Object.entries(
        rankingParams({
          headliners: ["h-1", "h-2"],
          input: "v-1",
          band: mid,
          ages: ["25_to_29", "30_to_34"],
        }),
      ),
    }).toEqual(
      await sent((get) =>
        artistsEndpoint(get)({
          signalEntityIds: ["h-1", "h-2", "v-1"],
          popularityMin: mid.minPopularity,
          popularityMax: mid.maxPopularity,
          excludeEntityIds: ["h-1", "h-2"],
          ages: ["25_to_29", "30_to_34"],
        }),
      ),
    );
  });

  it("the headliners alone: baseline_artists' parameters", async () => {
    expect(
      Object.entries(
        rankingParams({
          headliners: ["h-1", "h-2"],
          input: null,
          band: mid,
          ages: ["25_to_29"],
        }),
      ),
    ).toEqual(
      (
        await sent((get) =>
          artistsEndpoint(get)({
            signalEntityIds: ["h-1", "h-2"],
            popularityMin: mid.minPopularity,
            popularityMax: mid.maxPopularity,
            excludeEntityIds: ["h-1", "h-2"],
            ages: ["25_to_29"],
          }),
        )
      ).params,
    );
  });

  it("a town's music rooms: find_venues' parameters", async () => {
    expect({
      path: "/v2/insights",
      params: Object.entries(placesParams("Alder", TAG)),
    }).toEqual(
      await sent((get) =>
        placesEndpoint(get)({ locationQuery: "Alder", tagId: TAG }),
      ),
    );
  });

  it("a venue's popularity by id: the app's /entities parameters", async () => {
    expect({
      path: "/entities",
      params: Object.entries(entitiesParams(["v-1", "v-2"])),
    }).toEqual(await sent((get) => entitiesEndpoint(get)(["v-1", "v-2"])));
  });
});

// Places with Qloo's geocode, for find_venues' "town, region" second ask (M6j).
const place = (id: string, region: string | null) => ({
  entity_id: id,
  name: `Room ${id}`,
  popularity: 0.5,
  ...(region
    ? {
        properties: {
          geocode: { admin1_region: region, country: region },
        },
      }
    : {}),
});
const PLACES: Record<string, unknown[]> = {
  Plainville: ["p1", "p2", "p3", "p4", "p5", "p6"].map((id) =>
    place(id, "Alpha"),
  ),
  Twin: [place("t1", "Gamma"), place("t2", "Gamma"), place("t3", "Beta")],
  "Twin, Beta": [
    place("t3", "Beta"),
    place("t4", "Beta"),
    place("t5", "Beta"),
    place("t6", "Gamma"),
  ],
  Bare: [place("b1", null), place("b2", null)],
};
const placesAnswer = (query: string) => ({
  success: true,
  results: { entities: PLACES[query] ?? [] },
});

describe("findVenues reads a town's rooms as the agent's find_venues does", () => {
  const towns: CheckedTown[] = [
    { city: "Plainville", region: "Alpha", country: "Alpha" },
    { city: "Twin", region: "Beta", country: "Beta" },
    { city: "Bare", region: "Delta", country: "Delta" },
  ];

  for (const town of towns)
    it(`${town.city}: the same rooms, from the same calls`, async () => {
      const agentQueries: string[] = [];
      const fetch = (async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const query = url.searchParams.get("filter.location.query")!;
        agentQueries.push(query);
        return new Response(JSON.stringify(placesAnswer(query)), {
          status: 200,
        });
      }) as typeof globalThis.fetch;
      const toolbox = createToolbox({
        festival: checkedFestival(town),
        qloo: createQlooClient({
          apiKey: "test",
          cache: createMemoryCache(),
          fetch,
        }),
        emit: () => {},
      });
      const outcome = await toolbox.run("find_venues", { tag_id: TAG });
      expect(outcome.isError).toBe(false);

      const ourQueries: string[] = [];
      const found = await findVenues(
        async (path, params) => {
          expect(path).toBe("/v2/insights");
          ourQueries.push(String(params["filter.location.query"]));
          return placesAnswer(String(params["filter.location.query"]));
        },
        town,
        TAG,
      );
      expect(found.rooms.map((room) => room.entityId)).toEqual(
        toolbox.state.venues.map((venue) => venue.entityId),
      );
      expect(ourQueries).toEqual(agentQueries);
      expect(found.answers).toHaveLength(agentQueries.length);
    });
});

describe("section 37's control town", () => {
  it("is the next checked town in alphabetical order in another country, wrapping round", () => {
    expect(
      Object.fromEntries(
        CHECKED_TOWNS.map((town) => [
          town.city,
          controlTownOf(CHECKED_TOWNS, town.city).city,
        ]),
      ),
    ).toEqual({
      Aarhus: "Asheville",
      Asheville: "Berlin",
      Austin: "Berlin",
      Berlin: "Boise",
      Boise: "Bucharest",
      Bozeman: "Bucharest",
      // Section 34's table has Calgary, Oslo and Utrecht for these three: it also needed as
      // many anchor venues as the festival's own town. Section 37 picks one music room from
      // the control town, so its parenthetical has no such clause.
      Bucharest: "Burlington",
      Montreal: "Nashville",
      Tallinn: "Toronto",
      Burlington: "Calgary",
      Calgary: "Chicago",
      Chicago: "Cluj-Napoca",
      "Cluj-Napoca": "Denver",
      Denver: "Hamburg",
      Duluth: "Hamburg",
      Hamburg: "Kansas City",
      "Kansas City": "Montreal",
      Minneapolis: "Montreal",
      Nashville: "Oslo",
      Oslo: "Paris",
      Paris: "Raleigh",
      Raleigh: "Reykjavík",
      Reykjavík: "Rotterdam",
      Rotterdam: "Seattle",
      Seattle: "Tallinn",
      Toronto: "Utrecht",
      Utrecht: "Vienna",
      Vienna: "Wrexham",
      Wrexham: "Aarhus",
    });
  });
});

describe("reading what the saved build and Qloo's answer say", () => {
  it("unscoredInputs: the signal inputs a not_found warning names", () => {
    expect(
      unscoredInputs({
        results: { entities: [] },
        warnings: [
          { type: "not_found", "signal.interests.entities": ["a", "b"] },
          { type: "other", "signal.interests.entities": ["c"] },
          { type: "not_found", "filter.results.entities": ["d"] },
        ],
      }),
    ).toEqual(["a", "b"]);
    expect(unscoredInputs({ results: { entities: [] } })).toEqual([]);
    expect(unscoredInputs(null)).toEqual([]);
    expect(unscoredInputs({ warnings: "none" })).toEqual([]);
  });

  it("venueTagOf: the tag the build's own find_venues sent", () => {
    expect(venueTagOf(BUILDS[0])).toBe(TAG);
    expect(() => venueTagOf({ ...BUILDS[0], trace: [] })).toThrow(
      /find_venues/,
    );
  });
});
