// WS9 (the first screen's redesign), step 1: the page's photos, the lineup's and the headliners',
// are read from the Qloo cache only, so a cache miss never calls Qloo while a page renders. The
// warm-up uses the very function the page reads with, so its cache keys are the page's. Synthetic
// ids and invented image URLs; no Qloo response data.
import { afterEach, describe, expect, it, vi } from "vitest";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { billImages, withArtistImages } from "@/server/artist-images";
import { readFirstBill } from "@/server/first-bill";
import { createQlooClient } from "@/server/qloo";
import { createQlooCache } from "@/server/qloo-cache";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";
import { fakeFetch, params } from "../m2/fake-qloo";

const image = (id: string) => `https://images.qloo.com/i/synthetic-${id}.jpg`;

// Qloo's GET /entities, answering each id it was asked for with an image.
const entities = (url: URL) => ({
  success: true,
  results: params(url)
    .entity_ids.split(",")
    .map((id) => ({
      entity_id: id,
      name: `Entity ${id.slice(-3)}`,
      properties: { image: { url: image(id) } },
    })),
});

const bill = async () =>
  (await readFirstBill(
    { latest: async () => syntheticSavedBuild() },
    SAGEBRUSH_SOUND.id,
  ))!;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the first screen's photos", () => {
  it("carries the saved build's headliners, with their Qloo ids, from its context", async () => {
    const saved = syntheticSavedBuild();
    expect((await bill()).headliners).toEqual(
      saved.context.headliners.map(({ entityId, name }) => ({
        entityId,
        name,
      })),
    );
  });

  it("reads the lineup's and the headliners' images in one /entities call each", async () => {
    const fake = fakeFetch(entities);
    const qloo = createQlooClient({
      apiKey: "test-key",
      cache: createQlooCache(),
      fetch: fake.fetch,
    });
    const first = await bill();
    const read = await billImages(first, qloo);
    expect(Object.keys(read.images!)).toEqual(
      first.acts.map((act) => act.entityId),
    );
    expect(read.headlinerImages).toEqual(
      Object.fromEntries(
        first.headliners!.map(({ entityId }) => [entityId, image(entityId)]),
      ),
    );
    expect(fake.requests.map((request) => request.url.pathname)).toEqual([
      "/entities",
      "/entities",
    ]);
  });

  it("renders from the Qloo cache only: a miss calls nothing and the photos stay out", async () => {
    vi.stubEnv("QLOO_API_KEY", "test-key");
    const fetch = vi.fn(async () =>
      Response.json(entities(new URL("https://x/"))),
    );
    vi.stubGlobal("fetch", fetch);
    const first = await bill();
    // Ids no cache holds, so the read is a miss.
    const missing = {
      ...first,
      acts: first.acts.map((act) => ({
        ...act,
        entityId: `${act.entityId}-uncached`,
      })),
      headliners: first.headliners!.map((headliner) => ({
        ...headliner,
        entityId: `${headliner.entityId}-uncached`,
      })),
    };
    const served = await withArtistImages(missing);
    expect(fetch).not.toHaveBeenCalled();
    expect(served!.images).toBeUndefined();
    expect(served!.headlinerImages).toBeUndefined();
  });

  it("shows what the warm-up cached, with the same calls the page makes", async () => {
    vi.stubEnv("QLOO_API_KEY", "test-key");
    // Ids of its own: the process's memory cache is shared by every test in this file.
    const saved = await bill();
    const first = {
      ...saved,
      acts: saved.acts.map((act) => ({
        ...act,
        entityId: `${act.entityId}-warm`,
      })),
      headliners: saved.headliners!.map((headliner) => ({
        ...headliner,
        entityId: `${headliner.entityId}-warm`,
      })),
    };
    // The warm-up: the page's own function, with a client that may call Qloo.
    const warm = fakeFetch(entities);
    await billImages(
      first,
      createQlooClient({
        apiKey: "test-key",
        cache: createQlooCache(),
        fetch: warm.fetch,
      }),
    );
    expect(warm.requests).toHaveLength(2);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const served = await withArtistImages(first);
    expect(fetch).not.toHaveBeenCalled();
    expect(Object.keys(served!.images!)).toHaveLength(first.acts.length);
    expect(Object.keys(served!.headlinerImages!)).toEqual(
      first.headliners!.map((headliner) => headliner.entityId),
    );
  });
});
