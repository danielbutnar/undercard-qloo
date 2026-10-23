// WS4, the buyer's shortlist, step 5: Boise's page opens on the model's own ten picks from its
// saved Without Qloo answer, sorted from the Qloo cache only; the page never calls Qloo. What
// scripts/shortlist-example.ts runs (writeShortlistExample) reads the picks' searches from the
// cache and makes at most 4 insights calls, written through the same cache the page reads.
// Invented names and ids.
import { describe, expect, it, vi } from "vitest";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore } from "@/server/build-store";
import { handleLlmOnly } from "@/server/llm-only";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import {
  callBudget,
  shortlistExample,
  writeShortlistExample,
} from "@/server/shortlist";
import {
  fakeFetch,
  id,
  params,
  qlooWorld,
  savedBuild,
  shortlistQloo,
} from "./world";

const PICKS = [
  "Velvet Coyote",
  "The Long Drives",
  "Marigold Static",
  "Paper Canyon",
  "Dusk Arcade",
  "Honey Basin",
  "Lowland Choir",
  "Silver Mesa",
  "Nobody Knows Us",
  "Never Searched",
];

/** A saved build and the model's saved answer, with every pick's search cached but the last. */
async function savedWorld(build = savedBuild()) {
  const cache = createMemoryCache();
  const store = createBuildStore(cache);
  await store.save(build);
  await handleLlmOnly({
    festival: SAGEBRUSH_SOUND,
    cache,
    limiter: createMemoryLimiter(),
    ip: "203.0.113.7",
    model: () => ({
      suggest: async () => PICKS.map((name) => ({ name, note: "Invented." })),
    }),
  });
  const searches = qlooWorld(shortlistQloo(), cache);
  await callBudget({ ...searches, cap: 14 }).run(
    PICKS.slice(0, -1).map((query) => (qloo) => qloo.search({ query })),
  );
  return { cache, store };
}

/** The cache as the page may use it: reads only; a write would mean it fetched something. */
function readOnly(cache: QlooCache) {
  const sets = vi.fn();
  const reader: QlooCache = {
    kind: "memory",
    get: (key) => cache.get(key),
    set: async (...args) => void sets(...args),
  };
  return { reader, sets };
}

describe("Boise's example (WS4, step 5)", () => {
  it("is computed with the picks' searches from the cache and at most 4 insights calls", async () => {
    const { cache, store } = await savedWorld();
    const qloo = fakeFetch(shortlistQloo());

    const { shortlist, insightsCalls } = await writeShortlistExample({
      festival: SAGEBRUSH_SOUND,
      cache,
      store,
      apiKey: "test-key",
      fetch: qloo.fetch,
    });

    expect(qloo.requests.map(({ url }) => url.pathname)).toEqual(
      Array(4).fill("/v2/insights"),
    );
    expect(insightsCalls).toBe(4);
    // The one pick the cache has no search for isn't searched: it reads "not checked".
    expect(
      shortlist.acts.find((act) => act.name === "Never Searched")?.status,
    ).toBe("not-checked");
    expect(
      qloo.requests.every(
        ({ url }) => params(url)["filter.results.entities"] !== undefined,
      ),
    ).toBe(true);
  });

  it("opens the page on the model's own ten picks, sorted from the cache alone", async () => {
    const { cache, store } = await savedWorld();
    const { shortlist: written } = await writeShortlistExample({
      festival: SAGEBRUSH_SOUND,
      cache,
      store,
      apiKey: "test-key",
      fetch: fakeFetch(shortlistQloo()).fetch,
    });
    const { reader, sets } = readOnly(cache);

    const example = await shortlistExample({
      festival: SAGEBRUSH_SOUND,
      cache: reader,
    });

    expect(example?.festivalId).toBe(SAGEBRUSH_SOUND.id);
    expect(example?.names).toEqual(PICKS);
    expect(example?.shortlist?.acts).toEqual(written.acts);
    expect(example?.shortlist?.calls.every((call) => call.cached)).toBe(true);
    expect(example?.shortlist?.made).toBe(0);
    expect(example?.shortlist?.acts[0]).toMatchObject({
      qlooName: "Marigold Static",
      climb: 5,
    });
    expect(sets).not.toHaveBeenCalled();
  });

  it("before the example is computed, still opens on the ten picks, with no rows and no call", async () => {
    const { cache } = await savedWorld();
    const { reader, sets } = readOnly(cache);

    const example = await shortlistExample({
      festival: SAGEBRUSH_SOUND,
      cache: reader,
    });

    expect(example).toEqual({
      festivalId: SAGEBRUSH_SOUND.id,
      names: PICKS,
      shortlist: null,
    });
    expect(sets).not.toHaveBeenCalled();
  });

  it("has no example without a saved Without Qloo answer", async () => {
    const cache = createMemoryCache();
    await createBuildStore(cache).save(savedBuild());

    expect(
      await shortlistExample({ festival: SAGEBRUSH_SOUND, cache }),
    ).toBeNull();
  });

  it("refuses a fifth insights call", async () => {
    const build = savedBuild();
    const { cache, store } = await savedWorld({
      ...build,
      context: {
        ...build.context,
        anchors: {
          ...build.context.anchors,
          mid: [
            ...(build.context.anchors.mid ?? []),
            { entityId: id(204), name: "Linden Street Annex" },
          ],
        },
      },
    });

    await expect(
      writeShortlistExample({
        festival: SAGEBRUSH_SOUND,
        cache,
        store,
        apiKey: "test-key",
        fetch: fakeFetch(shortlistQloo()).fetch,
      }),
    ).rejects.toThrow("over the 4 insights calls approved");
  });
});
