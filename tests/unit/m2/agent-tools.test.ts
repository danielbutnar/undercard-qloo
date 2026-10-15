import { describe, expect, it } from "vitest";
import type { BuildEvent } from "@/lib/build-events";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createToolbox } from "@/server/agent-tools";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { fakeFetch, params, syntheticId, syntheticQloo } from "./fake-qloo";

const VENUE_TAG = "urn:tag:genre:place:live_music_venue";

function setup() {
  const fake = fakeFetch(syntheticQloo);
  const events: BuildEvent[] = [];
  const toolbox = createToolbox({
    festival: SAGEBRUSH_SOUND,
    qloo: createQlooClient({
      apiKey: "test-key",
      cache: createMemoryCache(),
      fetch: fake.fetch,
    }),
    emit: (event) => events.push(event),
  });
  const last = () => fake.requests.at(-1)!;
  return { toolbox, requests: fake.requests, events, last };
}

async function resolveHeadlinersAndVenues(
  toolbox: ReturnType<typeof setup>["toolbox"],
) {
  await toolbox.run("search_artist", { name: "Khruangbin" });
  await toolbox.run("search_artist", { name: "Japanese Breakfast" });
  await toolbox.run("find_venues", { tag_id: VENUE_TAG });
}

describe("agent tools: query parameters", () => {
  it("search_artist calls /search for an artist by name", async () => {
    const { toolbox, last } = setup();
    await toolbox.run("search_artist", { name: "Khruangbin" });
    expect(last().url.pathname).toBe("/search");
    expect(params(last().url)).toEqual({
      query: "Khruangbin",
      types: "urn:entity:artist",
      take: "5",
    });
  });

  it("find_tag calls /v2/tags scoped to an entity type", async () => {
    const { toolbox, last } = setup();
    await toolbox.run("find_tag", {
      query: "live music venue",
      entity_type: "place",
    });
    expect(last().url.pathname).toBe("/v2/tags");
    expect(params(last().url)).toEqual({
      "filter.query": "live music venue",
      "filter.parents.types": "urn:entity:place",
      take: "10",
    });
  });

  it("find_venues calls /v2/insights for places in the festival's city", async () => {
    const { toolbox, last } = setup();
    await toolbox.run("find_venues", { tag_id: VENUE_TAG });
    expect(params(last().url)).toEqual({
      "filter.type": "urn:entity:place",
      "filter.location.query": "Boise",
      "filter.tags": VENUE_TAG,
      take: "20",
    });
  });

  it("compare_headliners calls Analysis Compare with one headliner on each side", async () => {
    const { toolbox, last } = setup();
    await resolveHeadlinersAndVenues(toolbox);
    await toolbox.run("compare_headliners", {});
    expect(last().url.pathname).toBe("/v2/analysis/compare");
    expect(params(last().url)).toEqual({
      "a.signal.interests.entities": syntheticId(1),
      "b.signal.interests.entities": syntheticId(2),
      take: "25",
    });
  });

  it("baseline_artists seeds artist insights with both headliners inside the band", async () => {
    const { toolbox, last } = setup();
    await resolveHeadlinersAndVenues(toolbox);
    await toolbox.run("baseline_artists", { band: "mid" });
    expect(params(last().url)).toEqual({
      "filter.type": "urn:entity:artist",
      "signal.interests.entities": `${syntheticId(1)},${syntheticId(2)}`,
      "filter.popularity.min": "0.8",
      "filter.popularity.max": "0.92",
      "filter.exclude.entities": `${syntheticId(1)},${syntheticId(2)}`,
      take: "50",
    });
  });

  it("venue_artists adds the anchor venue to the signal, never a location parameter", async () => {
    const { toolbox, last } = setup();
    await resolveHeadlinersAndVenues(toolbox);
    await toolbox.run("venue_artists", {
      band: "opener",
      venue_id: syntheticId(201),
    });
    const sent = params(last().url);
    expect(sent).toEqual({
      "filter.type": "urn:entity:artist",
      "signal.interests.entities": `${syntheticId(1)},${syntheticId(2)},${syntheticId(201)}`,
      "filter.popularity.min": "0.55",
      "filter.popularity.max": "0.8",
      "filter.exclude.entities": `${syntheticId(1)},${syntheticId(2)}`,
      take: "50",
    });
    expect(Object.keys(sent).some((key) => key.includes("location"))).toBe(
      false,
    );
  });
});

describe("agent tools: guards and trace", () => {
  it("refuses a venue the agent hasn't found, without calling Qloo", async () => {
    const { toolbox, requests } = setup();
    await resolveHeadlinersAndVenues(toolbox);
    const before = requests.length;
    const result = await toolbox.run("venue_artists", {
      band: "mid",
      venue_id: syntheticId(999),
    });
    expect(result.isError).toBe(true);
    expect(requests).toHaveLength(before);
  });

  it("asks for the headliners before an artist call", async () => {
    const { toolbox, requests } = setup();
    const result = await toolbox.run("baseline_artists", { band: "mid" });
    expect(result.isError).toBe(true);
    expect(requests).toHaveLength(0);
  });

  it("emits a trace event per Qloo call with its endpoint, readable parameters and result count", async () => {
    const { toolbox, events } = setup();
    await resolveHeadlinersAndVenues(toolbox);
    await toolbox.run("venue_artists", {
      band: "mid",
      venue_id: syntheticId(201),
    });
    const calls = events.flatMap((event) =>
      event.type === "call" ? [event.call] : [],
    );
    expect(calls.map((call) => call.n)).toEqual([1, 2, 3, 4]);
    const last = calls[3];
    expect(last).toMatchObject({
      endpoint: "/v2/insights",
      resultCount: 50,
      cached: false,
    });
    expect(last.summary).toBe(
      "Mid-band artists for the headliners and The Lantern Room",
    );
    expect(last.params).toContainEqual({
      key: "signal.interests.entities",
      value: "Khruangbin, Japanese Breakfast, The Lantern Room",
    });
  });
});
