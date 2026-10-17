import { describe, expect, it } from "vitest";
import type { BuildEvent } from "@/lib/build-events";
import { roomKind } from "@/lib/place-kinds";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createToolbox } from "@/server/agent-tools";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { fakeFetch, params, syntheticId, syntheticQloo } from "../m2/fake-qloo";

// M6o: a festival brand filed as a place, told by Qloo's own keywords for it.
const kind = (slug: string) => ({ id: `urn:tag:category:place:${slug}` });

describe("a festival filed as a place", () => {
  it("is named when festival is among its three most frequent Qloo keywords", () => {
    expect(roomKind([], ["festival", "artists", "atmosphere"])).toBe(
      "a festival",
    );
    expect(roomKind([], ["atmosphere", "drinks", "festival"])).toBe(
      "a festival",
    );
    expect(roomKind([kind("park")], ["festival"])).toBe("a festival");
  });

  it("isn't named for a lower keyword, or none", () => {
    expect(roomKind([], ["beer", "bands", "staff", "festival"])).toBeNull();
    expect(roomKind([], [])).toBeNull();
    expect(roomKind([kind("park")])).toBe("an outdoor festival site");
  });
});

describe("Qloo's keywords on a place", () => {
  it("are read in order of how often reviews use them", async () => {
    const fake = fakeFetch(() => ({
      results: {
        entities: [
          {
            entity_id: syntheticId(201),
            name: "Jazz Lawn",
            properties: {
              keywords: [
                { name: "atmosphere", count: 4 },
                { name: "festival", count: 11 },
                { name: "drinks", count: 3 },
              ],
            },
          },
        ],
      },
    }));
    const qloo = createQlooClient({
      apiKey: "k",
      cache: createMemoryCache(),
      fetch: fake.fetch,
    });
    const { data } = await qloo.places({
      locationQuery: "Boise",
      tagId: "urn:tag:genre:place:live_music_venue",
    });
    expect(data[0].keywords).toEqual(["festival", "atmosphere", "drinks"]);
  });

  it("label the venue's trace line and run, and the booking doesn't read them", async () => {
    const festival = {
      entity_id: syntheticId(201),
      name: "The Lantern Room",
      popularity: 0.8,
      tags: [
        {
          id: "urn:tag:category:place:live_music_venue",
          name: "Live music venue",
          type: "urn:tag:category:place",
        },
      ],
      properties: {
        keywords: [
          { name: "festival", count: 9 },
          { name: "bands", count: 2 },
        ],
      },
    };
    const fake = fakeFetch((url) => {
      const body = syntheticQloo(url) as {
        results?: { entities?: { entity_id: string }[] };
      };
      if (
        params(url)["filter.type"] === "urn:entity:place" &&
        body.results?.entities
      )
        return {
          ...body,
          results: {
            entities: body.results.entities.map((entity) =>
              entity.entity_id === festival.entity_id ? festival : entity,
            ),
          },
        };
      return body;
    });
    const events: BuildEvent[] = [];
    const toolbox = createToolbox({
      festival: SAGEBRUSH_SOUND,
      qloo: createQlooClient({
        apiKey: "k",
        cache: createMemoryCache(),
        fetch: fake.fetch,
      }),
      emit: (event) => events.push(event),
    });
    await toolbox.run("search_artist", { name: "Khruangbin" });
    await toolbox.run("search_artist", { name: "Japanese Breakfast" });
    await toolbox.run("find_venues", {
      tag_id: "urn:tag:genre:place:live_music_venue",
    });
    await toolbox.run("baseline_artists", { band: "mid" });
    await toolbox.run("venue_artists", {
      band: "mid",
      venue_id: festival.entity_id,
    });
    const line = events.flatMap((event) =>
      event.type === "call" && event.call.tool === "venue_artists"
        ? [event.call.summary]
        : [],
    )[0];
    expect(line).toContain("The Lantern Room (a festival)");
    expect(toolbox.state.venueRuns[0].venue).toMatchObject({
      kind: "a festival",
    });
  });
});

describe("place answers cached before M6o", () => {
  it("aren't reused, since they were saved without keywords", async () => {
    const cache = createMemoryCache();
    const fake = fakeFetch(() => ({ results: { entities: [] } }));
    const tagId = "urn:tag:genre:place:live_music_venue";
    const old = new URLSearchParams(
      [
        ["filter.location.query", "Boise"],
        ["filter.tags", tagId],
        ["filter.type", "urn:entity:place"],
        ["take", "20"],
      ].sort(),
    );
    await cache.set(`qloo:v2:/v2/insights?${old}`, [{ entityId: "x", name: "Old", popularity: 0, affinity: null, tags: [] }], 60);
    const qloo = createQlooClient({ apiKey: "k", cache, fetch: fake.fetch });
    const { call } = await qloo.places({ locationQuery: "Boise", tagId });
    expect(call.cached).toBe(false);
    expect(fake.requests).toHaveLength(1);
  });
});
