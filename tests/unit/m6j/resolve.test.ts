import { describe, expect, it } from "vitest";
import type { BuildEvent } from "@/lib/build-events";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import {
  inRegion,
  inTown,
  needsFullName,
  placesInRegion,
  resolvedName,
} from "@/lib/town-resolution";
import { createToolbox } from "@/server/agent-tools";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { fakeFetch, params, syntheticId, syntheticQloo } from "../m2/fake-qloo";

const VERMONT = {
  name: "Old North End",
  admin2: "Chittenden County",
  admin1: "Vermont",
  countryCode: "US",
};
const ONTARIO = {
  name: "Maple",
  admin2: "Halton",
  admin1: "Ontario",
  countryCode: "CA",
};

describe("where a place is", () => {
  it("is in a region by its state, province, nation or country", () => {
    expect(inRegion(VERMONT, "Vermont")).toBe(true);
    expect(inRegion(VERMONT, "US")).toBe(true);
    expect(inRegion(ONTARIO, "Vermont")).toBe(false);
    expect(inRegion({ admin1: "Québec", countryCode: "CA" }, "Quebec")).toBe(
      true,
    );
    expect(inRegion(undefined, "Vermont")).toBe(false);
  });

  it("is in a town by Qloo's city first: a neighbourhood like South End is still Burlington", () => {
    expect(
      inTown(
        { city: "Burlington", name: "South End", admin2: "Chittenden County" },
        "Burlington",
      ),
    ).toBe(true);
    expect(
      inTown({ city: "Winooski", admin2: "Chittenden County" }, "Burlington"),
    ).toBe(false);
  });

  it("is in a town when its own name or its county names it, without a city", () => {
    expect(inTown({ name: "Richmond", admin1: "Virginia" }, "Richmond")).toBe(
      true,
    );
    expect(
      inTown({ name: "Henrico County", admin1: "Virginia" }, "Richmond"),
    ).toBe(false);
    expect(
      inTown({ name: "Kemptown", admin2: "Brighton and Hove" }, "Brighton"),
    ).toBe(true);
  });

  it("asks again with the full name when the plain name misses the region, never otherwise", () => {
    const place = (where: typeof VERMONT) => ({ where });
    expect(needsFullName(Array(4).fill(place(ONTARIO)), "Vermont")).toBe(true);
    expect(needsFullName([place(VERMONT)], "Virginia")).toBe(true);
    expect(needsFullName([], "England")).toBe(true);
    expect(
      needsFullName(
        Array(8).fill(place({ ...VERMONT, admin1: "Idaho" })),
        "Idaho",
      ),
    ).toBe(false);
    // Older cached answers carry no geocode: the plain name stands.
    expect(needsFullName([{}, {}, {}], "Idaho")).toBe(false);
    expect(needsFullName(Array(4).fill(place(ONTARIO)), "")).toBe(false);
  });

  it("keeps the answer with more places in the region, and names where it resolved", () => {
    const plain = Array.from({ length: 4 }, () => ({ where: ONTARIO }));
    const full = Array.from({ length: 7 }, () => ({ where: VERMONT }));
    const chosen = placesInRegion([plain, full], "Vermont");
    expect(chosen.answer).toBe(1);
    expect(chosen.places).toHaveLength(7);
    expect(resolvedName("Burlington", chosen.places)).toBe(
      "Burlington, Vermont, US",
    );
  });
});

describe("the agent's venue search, with a town and its region", () => {
  const place = (n: number, name: string, where: Record<string, string>) => ({
    entity_id: syntheticId(n),
    name,
    popularity: 0.8,
    properties: { geocode: where },
    tags: [
      {
        id: "urn:tag:category:place:live_music_venue",
        name: "Live music venue",
        type: "urn:tag:category:place",
      },
    ],
  });
  const ontario = {
    name: "Maple",
    admin2_region: "Halton",
    admin1_region: "Ontario",
    country_code: "CA",
  };
  const vermont = {
    name: "Old North End",
    admin2_region: "Chittenden County",
    admin1_region: "Vermont",
    country_code: "US",
  };

  function setup(city: string, region: string) {
    const fake = fakeFetch((url) => {
      const p = params(url);
      if (p["filter.type"] === "urn:entity:place") {
        if (p["filter.location.query"] === "Burlington")
          return {
            results: {
              entities: [1, 2, 3, 4].map((n) =>
                place(300 + n, `Ontario Room ${n}`, ontario),
              ),
            },
          };
        if (p["filter.location.query"] === "Burlington, Vermont")
          return {
            results: {
              entities: [1, 2, 3, 4, 5, 6, 7].map((n) =>
                place(310 + n, `Vermont Room ${n}`, vermont),
              ),
            },
          };
      }
      return syntheticQloo(url);
    });
    const events: BuildEvent[] = [];
    const toolbox = createToolbox({
      festival: { ...SAGEBRUSH_SOUND, city, region },
      qloo: createQlooClient({
        apiKey: "k",
        cache: createMemoryCache(),
        fetch: fake.fetch,
      }),
      emit: (event) => events.push(event),
    });
    const venueCalls = () =>
      events.flatMap((event) =>
        event.type === "call" && event.call.tool === "find_venues"
          ? [event.call]
          : [],
      );
    return { toolbox, venueCalls };
  }

  it("asks again as “Burlington, Vermont” when “Burlington” reads Ontario, and names where it resolved", async () => {
    const { toolbox, venueCalls } = setup("Burlington", "Vermont");
    const outcome = await toolbox.run("find_venues", {
      tag_id: "urn:tag:genre:place:live_music_venue",
    });
    const result = JSON.parse(outcome.content as string) as {
      venues: { name: string }[];
      resolved_to: string;
    };
    expect(result.venues.map((venue) => venue.name)).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((n) => `Vermont Room ${n}`),
    );
    expect(result.resolved_to).toBe("Burlington, Vermont, US");
    const calls = venueCalls();
    expect(calls).toHaveLength(2);
    expect(calls[1].summary).toContain("asked again as “Burlington, Vermont”");
    expect(calls[1].summary).toContain("resolved to Burlington, Vermont, US");
    // The extra call is a real call: it counts against the build's 12.
    expect(toolbox.callsUsed()).toBe(2);
  });

  it("makes no extra call when the plain name's places carry no geocode to check", async () => {
    const { toolbox, venueCalls } = setup("Boise", "Idaho");
    await toolbox.run("find_venues", {
      tag_id: "urn:tag:genre:place:live_music_venue",
    });
    expect(venueCalls()).toHaveLength(1);
    expect(toolbox.callsUsed()).toBe(1);
  });
});
