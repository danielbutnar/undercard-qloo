import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient, QlooError } from "@/server/qloo";
import {
  fakeFetch,
  insightsBody,
  insightsEntity,
  params,
  searchEntity,
  syntheticId,
} from "./fake-qloo";

function clientWith(route: (url: URL) => unknown) {
  const fake = fakeFetch(route);
  const client = createQlooClient({
    apiKey: "test-key",
    cache: createMemoryCache(),
    fetch: fake.fetch,
  });
  return { client, requests: fake.requests };
}

describe("Qloo client", () => {
  it("sends GET requests with the X-Api-Key header to the hackathon base URL", async () => {
    const { client, requests } = clientWith(() => ({ results: [] }));
    await client.search({ query: "Hollow Pines" });
    const [request] = requests;
    expect(request.url.origin).toBe("https://hackathon.api.qloo.com");
    expect(request.init?.method ?? "GET").toBe("GET");
    expect(new Headers(request.init?.headers).get("X-Api-Key")).toBe(
      "test-key",
    );
  });

  it("searches artists by name on /search", async () => {
    const { client, requests } = clientWith(() => ({
      results: [searchEntity(1, "Hollow Pines", 0.99)],
    }));
    const { data, call } = await client.search({ query: "Hollow Pines" });
    expect(requests[0].url.pathname).toBe("/search");
    expect(params(requests[0].url)).toEqual({
      query: "Hollow Pines",
      types: "urn:entity:artist",
      take: "5",
    });
    expect(data[0]).toMatchObject({
      entityId: syntheticId(1),
      name: "Hollow Pines",
      popularity: 0.99,
    });
    expect(data[0].tags[0]).toEqual({
      id: "urn:tag:genre:dream_pop",
      name: "Dream Pop",
      type: "urn:tag:genre",
    });
    expect(call).toMatchObject({
      path: "/search",
      resultCount: 1,
      cached: false,
    });
  });

  it("finds tags by keyword on /v2/tags", async () => {
    const { client, requests } = clientWith(() => ({
      results: {
        tags: [
          {
            id: "urn:tag:genre:place:live_music_venue",
            name: "Live music venue",
          },
        ],
      },
    }));
    const { data } = await client.tags({
      query: "live music venue",
      parentType: "urn:entity:place",
    });
    expect(requests[0].url.pathname).toBe("/v2/tags");
    expect(params(requests[0].url)).toEqual({
      "filter.query": "live music venue",
      "filter.parents.types": "urn:entity:place",
      take: "10",
    });
    expect(data).toEqual([
      {
        id: "urn:tag:genre:place:live_music_venue",
        name: "Live music venue",
        type: "",
      },
    ]);
  });

  it("finds places in a city with a tag on /v2/insights (urn:entity:place)", async () => {
    const { client, requests } = clientWith(() => insightsBody([]));
    await client.places({
      locationQuery: "Boise",
      tagId: "urn:tag:genre:place:live_music_venue",
    });
    expect(requests[0].url.pathname).toBe("/v2/insights");
    expect(params(requests[0].url)).toEqual({
      "filter.type": "urn:entity:place",
      "filter.location.query": "Boise",
      "filter.tags": "urn:tag:genre:place:live_music_venue",
      take: "20",
    });
  });

  it("gets artist insights for a signal and a popularity band on /v2/insights (urn:entity:artist)", async () => {
    const { client, requests } = clientWith(() =>
      insightsBody([insightsEntity(10, "Juniper Static", 0.86, 0.93)]),
    );
    const { data } = await client.artists({
      signalEntityIds: [syntheticId(1), syntheticId(2)],
      popularityMin: 0.8,
      popularityMax: 0.92,
      excludeEntityIds: [syntheticId(1)],
    });
    expect(params(requests[0].url)).toEqual({
      "filter.type": "urn:entity:artist",
      "signal.interests.entities": `${syntheticId(1)},${syntheticId(2)}`,
      "filter.popularity.min": "0.8",
      "filter.popularity.max": "0.92",
      "filter.exclude.entities": syntheticId(1),
      take: "50",
    });
    expect(data[0]).toMatchObject({
      name: "Juniper Static",
      popularity: 0.86,
      affinity: 0.93,
    });
  });

  it("compares two groups of entities on /v2/analysis/compare", async () => {
    const { client, requests } = clientWith(() => ({
      results: {
        tags: [
          {
            tag_id: "urn:tag:genre:music:folk",
            name: "Folk",
            subtype: "urn:tag:genre:music",
            query: { score: 0.98 },
          },
        ],
        a: [],
        b: [],
      },
    }));
    const { data } = await client.compare({
      a: [syntheticId(1)],
      b: [syntheticId(2)],
    });
    expect(requests[0].url.pathname).toBe("/v2/analysis/compare");
    expect(params(requests[0].url)).toEqual({
      "a.signal.interests.entities": syntheticId(1),
      "b.signal.interests.entities": syntheticId(2),
      take: "25",
    });
    expect(data).toEqual([
      {
        tag: {
          id: "urn:tag:genre:music:folk",
          name: "Folk",
          type: "urn:tag:genre:music",
        },
        score: 0.98,
      },
    ]);
  });

  it("serves a repeated request from the server-side cache", async () => {
    const { client, requests } = clientWith(() => ({
      results: [searchEntity(1, "Hollow Pines", 0.99)],
    }));
    await client.search({ query: "Hollow Pines" });
    const second = await client.search({ query: "Hollow Pines" });
    expect(requests).toHaveLength(1);
    expect(second.call.cached).toBe(true);
    expect(second.data[0].name).toBe("Hollow Pines");
  });

  it("throws a QlooError on a failed request and caches nothing", async () => {
    const { client, requests } = clientWith(
      () => new Response("{}", { status: 429 }),
    );
    await expect(
      client.search({ query: "Hollow Pines" }),
    ).rejects.toBeInstanceOf(QlooError);
    await expect(
      client.search({ query: "Hollow Pines" }),
    ).rejects.toMatchObject({ status: 429 });
    expect(requests).toHaveLength(2);
  });

  it("never calls the legacy /recs or /recommendations endpoints", () => {
    const source = readFileSync(
      new URL("../../../src/server/qloo.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/\/recs\b|\/recommendations\b/);
  });
});
