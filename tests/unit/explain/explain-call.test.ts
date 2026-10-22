// WS7 part (a), step 1: Qloo's own split of each act's result (docs/evidence.md section 35), the
// call section 35 made, through the cached client. Invented ids and numbers only (the synthetic
// ids of tests/unit/m2); no Qloo response data.
import { describe, expect, it } from "vitest";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { fakeFetch, syntheticId } from "../m2/fake-qloo";

const HEADLINERS = [syntheticId(1), syntheticId(2)];
const VENUES = [syntheticId(201), syntheticId(202), syntheticId(203)];
const ACTS = [syntheticId(1001), syntheticId(1002), syntheticId(1003)];
const AGES = ["25_to_29", "30_to_34"];

const share = (n: number, score: number) => ({
  entity_id: syntheticId(n),
  score,
});

/** An Insights answer shaped like section 35's: each act with query.explainability. */
function explainedAct(n: number, shares: unknown[] | undefined) {
  return {
    name: `Invented Act ${n}`,
    entity_id: syntheticId(n),
    type: "urn:entity:artist",
    popularity: 0.85,
    query: {
      affinity: 0.9,
      ...(shares
        ? { explainability: { "signal.interests.entities": shares } }
        : {}),
    },
    tags: [],
  };
}

const answer = (entities: unknown[]) => ({
  success: true,
  results: { entities },
  warnings: [],
});

function clientWith(route: (url: URL) => unknown) {
  const fake = fakeFetch(route);
  const client = createQlooClient({
    apiKey: "test-key",
    cache: createMemoryCache(),
    fetch: fake.fetch,
  });
  return { client, requests: fake.requests };
}

const CALL = {
  signalEntityIds: [...HEADLINERS, ...VENUES],
  actIds: ACTS,
  ages: AGES,
};

describe("Qloo's split of each act's result (WS7 step 1)", () => {
  it("sends section 35's call: the headliners then the venues, the acts, the ages, explainability on", async () => {
    const { client, requests } = clientWith(() => answer([]));
    await client.explain(CALL);

    expect(requests).toHaveLength(1);
    const { url, init } = requests[0];
    expect(url.origin).toBe("https://hackathon.api.qloo.com");
    expect(url.pathname).toBe("/v2/insights");
    expect(init?.method ?? "GET").toBe("GET");
    // In section 35's order, so the request is the one it made.
    expect([...url.searchParams]).toEqual([
      ["filter.type", "urn:entity:artist"],
      ["signal.interests.entities", [...HEADLINERS, ...VENUES].join(",")],
      ["filter.results.entities", ACTS.join(",")],
      ["signal.demographics.age", "25_to_29,30_to_34"],
      ["feature.explainability", "true"],
      ["take", "3"],
    ]);
  });

  it("leaves the age out when the build sent none", async () => {
    const { client, requests } = clientWith(() => answer([]));
    await client.explain({ ...CALL, ages: [] });
    expect(requests[0].url.searchParams.has("signal.demographics.age")).toBe(
      false,
    );
    expect(requests[0].url.searchParams.get("take")).toBe("3");
  });

  it("reads each act's explainability list as { entityId, share }, keyed by the act, in Qloo's order", async () => {
    const { client } = clientWith(() =>
      answer([
        explainedAct(1002, [share(1, 0.4), share(202, 0.35), share(2, 0.25)]),
        explainedAct(1001, [share(2, 0.5), share(201, 0.3), share(1, 0.2)]),
      ]),
    );
    const { data, call } = await client.explain(CALL);

    expect(data).toEqual([
      {
        entityId: syntheticId(1002),
        shares: [
          { entityId: syntheticId(1), share: 0.4 },
          { entityId: syntheticId(202), share: 0.35 },
          { entityId: syntheticId(2), share: 0.25 },
        ],
      },
      {
        entityId: syntheticId(1001),
        shares: [
          { entityId: syntheticId(2), share: 0.5 },
          { entityId: syntheticId(201), share: 0.3 },
          { entityId: syntheticId(1), share: 0.2 },
        ],
      },
    ]);
    expect(call).toMatchObject({
      path: "/v2/insights",
      resultCount: 2,
      cached: false,
    });
  });

  it("gives an act with no explainability an empty split", async () => {
    const { client } = clientWith(() =>
      answer([
        explainedAct(1001, undefined),
        { ...explainedAct(1002, undefined), query: undefined },
        {
          ...explainedAct(1003, undefined),
          query: { affinity: 0.8, explainability: {} },
        },
      ]),
    );
    const { data } = await client.explain(CALL);
    expect(data).toEqual([
      { entityId: syntheticId(1001), shares: [] },
      { entityId: syntheticId(1002), shares: [] },
      { entityId: syntheticId(1003), shares: [] },
    ]);
  });

  it("rejects a malformed answer and caches nothing, so the next ask fetches again", async () => {
    for (const malformed of [
      { success: true },
      answer([
        explainedAct(1001, [{ entity_id: syntheticId(1), score: "0.4" }]),
      ]),
      answer([explainedAct(1001, [{ score: 0.4 }])]),
      answer([explainedAct(1001, [share(1, -0.1)])]),
      answer([explainedAct(1001, { not: "a list" } as unknown as unknown[])]),
    ]) {
      const { client, requests } = clientWith(() => malformed);
      await expect(client.explain(CALL)).rejects.toThrow();
      await expect(client.explain(CALL)).rejects.toThrow();
      expect(requests).toHaveLength(2);
    }
  });

  it("is served from the cache once made, with every parameter in its key", async () => {
    const { client, requests } = clientWith(() =>
      answer([explainedAct(1001, [share(1, 1)])]),
    );
    await client.explain(CALL);
    const again = await client.explain(CALL);
    expect(again.call.cached).toBe(true);
    expect(requests).toHaveLength(1);

    // Each parameter changes the key: another order of inputs, another act list, other ages.
    await client.explain({
      ...CALL,
      signalEntityIds: [...VENUES, ...HEADLINERS],
    });
    await client.explain({ ...CALL, actIds: ACTS.slice(0, 2) });
    await client.explain({ ...CALL, ages: ["25_to_29"] });
    await client.explain({ ...CALL, ages: [] });
    expect(requests).toHaveLength(5);
  });

  it("never fetches from a cache-only client", async () => {
    const fake = fakeFetch(() => answer([]));
    const client = createQlooClient({
      apiKey: "",
      cache: createMemoryCache(),
      cacheOnly: true,
      fetch: fake.fetch,
    });
    await expect(client.explain(CALL)).rejects.toThrow(/No cached Qloo answer/);
    expect(fake.requests).toHaveLength(0);
  });
});
