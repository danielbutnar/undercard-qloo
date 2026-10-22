// Daniel's brief of 2026-10-22 (prompt-4), step 2: the server loader behind the Without Qloo
// cards. For a saved model answer and its saved build, each pick's section 31 checks, read
// through a cache-only Qloo client whose fetch throws: no Qloo call, no model, no cache write.
// Invented names, ids and numbers (the synthetic Qloo of tests/unit/m2).
import { describe, expect, it, vi } from "vitest";
import type { LlmOnlyLineup, PickCheck } from "@/lib/llm-only";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { handleLlmOnly } from "@/server/llm-only";
import { pickChecks } from "@/server/pick-checks";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { createMemoryLimiter } from "@/server/rate-limit";
import {
  fakeFetch,
  HEADLINER_TAGS,
  params,
  searchEntity,
  syntheticQloo,
} from "../m2/fake-qloo";
import { readEvents, syntheticServer } from "../m3/scripted";

// What search answers for the model's picks. "Mid Act 50" ends the Mid headliners-only list
// and leads The Lantern Room's, which reverses it; the others sit in no list.
const SEARCHES: Record<string, unknown[]> = {
  "Mid Act 50": [
    searchEntity(1049, "Mid Act 50", 0.8, HEADLINER_TAGS.slice(1, 3)),
  ],
  "Too Big To Book": [
    searchEntity(901, "Too Big to Book", 0.97, HEADLINER_TAGS.slice(0, 2)),
  ],
  "Quiet Ones": [
    searchEntity(902, "Somebody Else", 0.7),
    searchEntity(
      903,
      "The Quiet Ones (band)",
      0.42,
      HEADLINER_TAGS.slice(2, 3),
    ),
  ],
  "Nobody Knows Us": [searchEntity(904, "Nobody Knows", 0.6)],
};
const ANSWER: LlmOnlyLineup = {
  festivalId: SAGEBRUSH_SOUND.id,
  createdAt: "2026-10-15T14:02:00.000Z",
  picks: [...Object.keys(SEARCHES), "Never Searched"].map((name) => ({
    name,
    note: "An invented reason.",
  })),
};

/** A synthetic build saved, its lists cached, and the picks' searches cached but the last. */
async function savedWorld() {
  const server = syntheticServer();
  await readEvents(server.build({ fresh: true }));
  const build = await server.store.latest(SAGEBRUSH_SOUND.id);
  const seeding = createQlooClient({
    apiKey: "test-key",
    cache: server.cache,
    fetch: fakeFetch((url) =>
      url.pathname === "/search"
        ? { results: SEARCHES[params(url).query] ?? [] }
        : syntheticQloo(url),
    ).fetch,
  });
  for (const name of Object.keys(SEARCHES))
    await seeding.search({ query: name });
  // The loader may only read: any write would mean it fetched something.
  const sets = vi.fn();
  const readOnly: QlooCache = {
    kind: "memory",
    get: (key) => server.cache.get(key),
    set: async (...args) => void sets(...args),
  };
  return { server, build, readOnly, sets };
}

describe("each pick's checks, from the Qloo cache alone (prompt-4, step 2)", () => {
  it("reads found, the fee range, genres and climb, not found and not checked, in pick order", async () => {
    const { server, build, readOnly, sets } = await savedWorld();
    expect(build).not.toBeNull();
    const before = server.requests.length;

    const checks = await pickChecks({
      answer: ANSWER,
      build,
      festival: SAGEBRUSH_SOUND,
      cache: readOnly,
    });

    expect(checks).toEqual<PickCheck[]>([
      {
        name: "Mid Act 50",
        status: "found",
        popularity: 0.8,
        range: "in",
        genres: 2,
        climb: 49,
      },
      {
        name: "Too Big To Book",
        status: "found",
        popularity: 0.97,
        range: "above",
        genres: 2,
        climb: null,
      },
      {
        name: "Quiet Ones",
        status: "found",
        popularity: 0.42,
        range: "below",
        genres: 1,
        climb: null,
      },
      { name: "Nobody Knows Us", status: "not-found" },
      { name: "Never Searched", status: "not-checked" },
    ]);
    expect(server.requests.length).toBe(before);
    expect(sets).not.toHaveBeenCalled();
  });

  it("checks nothing when the cache no longer holds the build's lists, or there's no saved build", async () => {
    const { build } = await savedWorld();
    const searchesOnly = createMemoryCache();
    const seeding = createQlooClient({
      apiKey: "test-key",
      cache: searchesOnly,
      fetch: fakeFetch((url) => ({
        results: SEARCHES[params(url).query] ?? [],
      })).fetch,
    });
    for (const name of Object.keys(SEARCHES))
      await seeding.search({ query: name });
    const notChecked = ANSWER.picks.map(({ name }) => ({
      name,
      status: "not-checked",
    }));

    expect(
      await pickChecks({
        answer: ANSWER,
        build,
        festival: SAGEBRUSH_SOUND,
        cache: searchesOnly,
      }),
    ).toEqual(notChecked);
    expect(
      await pickChecks({
        answer: ANSWER,
        build: null,
        festival: SAGEBRUSH_SOUND,
        cache: searchesOnly,
      }),
    ).toEqual(notChecked);
  });

  it("checks nothing against another festival's build", async () => {
    const { build, readOnly } = await savedWorld();
    const checks = await pickChecks({
      answer: ANSWER,
      build: { ...build!, festivalId: "somewhere-else" },
      festival: SAGEBRUSH_SOUND,
      cache: readOnly,
    });
    expect(checks.every((check) => check.status === "not-checked")).toBe(true);
  });
});

describe("POST /api/llm-only serves the checks with the saved answer", () => {
  const save = async (cache: QlooCache) =>
    handleLlmOnly({
      festival: SAGEBRUSH_SOUND,
      cache,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.9",
      model: () => ({ suggest: async () => ANSWER.picks }),
    });

  it("adds each pick's checks, and the model isn't asked", async () => {
    const cache = createMemoryCache();
    await save(cache);
    const model = vi.fn(() => null);
    const checks = vi.fn(async (lineup: LlmOnlyLineup) =>
      lineup.picks.map(({ name }): PickCheck => ({
        name,
        status: "not-checked",
      })),
    );

    const response = await handleLlmOnly({
      festival: SAGEBRUSH_SOUND,
      cache,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.9",
      model,
      checks,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(
      body.lineup.picks.map((pick: { name: string }) => pick.name),
    ).toEqual(ANSWER.picks.map((pick) => pick.name));
    expect(body.checks).toHaveLength(ANSWER.picks.length);
    expect(checks).toHaveBeenCalledTimes(1);
    expect(model).not.toHaveBeenCalled();
  });

  it("still serves the answer, without checks, when the checks fail", async () => {
    const cache = createMemoryCache();
    await save(cache);
    const response = await handleLlmOnly({
      festival: SAGEBRUSH_SOUND,
      cache,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.9",
      model: () => null,
      checks: async () => {
        throw new Error("the cache is down");
      },
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.lineup.picks).toHaveLength(ANSWER.picks.length);
    expect(body.checks).toBeUndefined();
  });
});
