// Artist images (item 4 of Daniel's brief of 2026-10-21): built, and off. Synthetic ids and
// invented image URLs; no Qloo response data.
import { describe, expect, it } from "vitest";
import { ARTIST_IMAGES } from "@/lib/artist-images";
import { readArtistImages, withArtistImages } from "@/server/artist-images";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { fakeFetch, params, syntheticId } from "../m2/fake-qloo";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

const image = (n: number) => `https://images.qloo.com/i/synthetic-${n}.jpg`;

function client(route: (url: URL) => unknown) {
  const fake = fakeFetch(route);
  return {
    qloo: createQlooClient({
      apiKey: "test-key",
      cache: createMemoryCache(),
      fetch: fake.fetch,
    }),
    requests: fake.requests,
  };
}

// Qloo's GET /entities, answering each id it was asked for with an image.
const entities = (url: URL) => ({
  success: true,
  results: params(url)
    .entity_ids.split(",")
    .map((id, n) => ({
      entity_id: id,
      name: `Act ${n}`,
      properties: { image: { url: image(n) } },
    })),
});

describe("artist images, built but off", () => {
  it("is off until Daniel says Qloo agreed", () => {
    expect(ARTIST_IMAGES).toBe(false);
  });

  it("reads a whole lineup's image URLs in one Qloo call, cached", async () => {
    const ids = [syntheticId(1), syntheticId(2), syntheticId(3)];
    const { qloo, requests } = client(entities);
    expect(await readArtistImages(qloo, ids)).toEqual({
      [ids[0]]: image(0),
      [ids[1]]: image(1),
      [ids[2]]: image(2),
    });
    expect(requests).toHaveLength(1);
    expect(requests[0].url.pathname).toBe("/entities");
    expect(params(requests[0].url).entity_ids).toBe(ids.join(","));
    await readArtistImages(qloo, ids);
    expect(requests).toHaveLength(1);
  });

  it("keeps only https images on images.qloo.com, and gives none when Qloo fails", async () => {
    const ids = [syntheticId(1), syntheticId(2), syntheticId(3)];
    const { qloo } = client(() => ({
      results: [
        {
          entity_id: ids[0],
          name: "A",
          properties: { image: { url: "http://images.qloo.com/i/a.jpg" } },
        },
        {
          entity_id: ids[1],
          name: "B",
          properties: { image: { url: "https://elsewhere.test/b.jpg" } },
        },
        { entity_id: ids[2], name: "C", properties: {} },
      ],
    }));
    expect(await readArtistImages(qloo, ids)).toEqual({});
    const broken = client(() => new Response("{}", { status: 404 }));
    expect(await readArtistImages(broken.qloo, ids)).toBeNull();
    expect(await readArtistImages(null, ids)).toBeNull();
  });

  it("leaves a saved build as it is, and calls nothing, while the setting is off", async () => {
    const { qloo, requests } = client(entities);
    expect(await withArtistImages(FIRST_BILL, qloo)).toBe(FIRST_BILL);
    expect(requests).toHaveLength(0);
  });

  it("adds the lineup's images to the saved build once it's on", async () => {
    const { qloo, requests } = client(entities);
    const bill = await withArtistImages(FIRST_BILL, qloo, true);
    expect(Object.keys(bill!.images!)).toEqual(acts.map((act) => act.entityId));
    expect(requests).toHaveLength(1);
    expect(await withArtistImages(null, qloo, true)).toBeNull();
  });
});
