// WS13 item 1: Qloo's per-signal warnings reach the agent. Section 35's raw answers
// (.design/explainability/, git-ignored) show the shape on /v2/insights: a top-level "warnings"
// list, each { type: "not_found", "signal.interests.entities": [<entity id>] }. Synthetic ids only.
import { describe, expect, it } from "vitest";
import {
  AGENT_CACHE_PREFIX,
  createQlooClient,
  QLOO_CACHE_PREFIX,
} from "@/server/qloo";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import {
  fakeFetch,
  insightsBody,
  insightsEntity,
  syntheticId,
} from "../m2/fake-qloo";

const HEADLINERS = [syntheticId(1), syntheticId(2)];
const VENUE = syntheticId(204);

const read = {
  signalEntityIds: [...HEADLINERS, VENUE],
  popularityMin: 0.8,
  popularityMax: 0.92,
  excludeEntityIds: HEADLINERS,
  ages: ["25_to_29", "30_to_34"],
};

const withWarnings = (warnings: unknown) => ({
  ...insightsBody([
    insightsEntity(10, "Juniper Static", 0.86, 0.93),
    insightsEntity(11, "Copper Lanterns", 0.84, 0.91),
  ]),
  warnings,
});

/** A cache that records every key it's asked for. */
function recordingCache(): QlooCache & { keys: string[] } {
  const inner = createMemoryCache();
  const keys: string[] = [];
  return {
    kind: "memory",
    keys,
    get: (key) => (keys.push(key), inner.get(key)),
    set: (key, value, ttl) => inner.set(key, value, ttl),
  };
}

function clientWith(body: unknown, cache: QlooCache = createMemoryCache()) {
  const fake = fakeFetch(() => body);
  return {
    client: createQlooClient({ apiKey: "test-key", cache, fetch: fake.fetch }),
    requests: fake.requests,
  };
}

describe("the scored artists read (WS13.1)", () => {
  it("returns the ranked artists and the signal inputs Qloo reported not found", async () => {
    const { client, requests } = clientWith(
      withWarnings([
        { type: "not_found", "signal.interests.entities": [VENUE] },
      ]),
    );
    const { data, call } = await client.scoredArtists(read);
    expect(data.unscored).toEqual([VENUE]);
    expect(data.entities.map((entity) => entity.name)).toEqual([
      "Juniper Static",
      "Copper Lanterns",
    ]);
    // The same parameters as the plain read, in the same order.
    expect([...requests[0].url.searchParams.keys()]).toEqual([
      "filter.type",
      "signal.interests.entities",
      "filter.popularity.min",
      "filter.popularity.max",
      "filter.exclude.entities",
      "signal.demographics.age",
      "take",
    ]);
    expect(call.resultCount).toBe(2);
  });

  it("finds none unscored when Qloo sends no warning", async () => {
    const { client } = clientWith(withWarnings(undefined));
    expect((await client.scoredArtists(read)).data.unscored).toEqual([]);
  });

  it("keeps only not_found warnings on the signal's entities, and never fails on a malformed one", async () => {
    const { client } = clientWith(
      withWarnings([
        { type: "deprecated", "signal.interests.entities": [HEADLINERS[0]] },
        { type: "not_found", "filter.tags": ["urn:tag:genre:music:x"] },
        { type: "not_found", "signal.interests.entities": "not a list" },
        { type: "not_found", "signal.interests.entities": [VENUE, 7] },
      ]),
    );
    const { data } = await client.scoredArtists(read);
    expect(data.unscored).toEqual([VENUE]);
    expect(data.entities).toHaveLength(2);

    const odd = clientWith(withWarnings("oops")).client;
    expect((await odd.scoredArtists(read)).data.unscored).toEqual([]);
  });

  it("is cached under its own key, so it never reads or replaces the plain read's entry", async () => {
    const cache = recordingCache();
    const { client, requests } = clientWith(
      withWarnings([
        { type: "not_found", "signal.interests.entities": [VENUE] },
      ]),
      cache,
    );
    const plain = await client.artists(read);
    const scored = await client.scoredArtists(read);
    expect(requests).toHaveLength(2);
    expect(plain.data).toHaveLength(2);
    expect(scored.call.cached).toBe(false);
    const [plainKey, scoredKey] = cache.keys;
    expect(plainKey).not.toBe(scoredKey);
    // A second scored read comes from its own entry, warnings included.
    const again = await client.scoredArtists(read);
    expect(requests).toHaveLength(2);
    expect(again.call.cached).toBe(true);
    expect(again.data.unscored).toEqual([VENUE]);
  });
});

describe("the cache prefix (WS13: the saved 1.0 builds' entries stay as they are)", () => {
  it("keys every answer under the client's prefix, the 1.0 builds' by default", async () => {
    const cache = recordingCache();
    const { client } = clientWith(withWarnings(undefined), cache);
    await client.artists(read);
    expect(QLOO_CACHE_PREFIX).toBe("qloo:v2:");
    expect(cache.keys[0].startsWith(QLOO_CACHE_PREFIX)).toBe(true);
    expect(client.cachePrefix).toBe(QLOO_CACHE_PREFIX);

    const agent = client.withPrefix(AGENT_CACHE_PREFIX);
    await agent.artists(read);
    expect(AGENT_CACHE_PREFIX).not.toBe(QLOO_CACHE_PREFIX);
    expect(cache.keys[1]).toBe(
      cache.keys[0].replace(QLOO_CACHE_PREFIX, AGENT_CACHE_PREFIX),
    );
    expect(agent.cachePrefix).toBe(AGENT_CACHE_PREFIX);
  });

  it("never lets a 2.0 answer reach a 1.0 entry: the same call under the agent's prefix is a new request", async () => {
    const cache = createMemoryCache();
    const { client, requests } = clientWith(withWarnings(undefined), cache);
    await client.artists(read);
    await client.withPrefix(AGENT_CACHE_PREFIX).artists(read);
    expect(requests).toHaveLength(2);
  });
});
