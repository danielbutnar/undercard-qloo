import { describe, expect, it } from "vitest";
import { fakeFetch, params, syntheticQloo } from "../m2/fake-qloo";
import { readEvents, syntheticServer } from "../m3/scripted";
import { ageBuckets } from "@/lib/ages";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleRefill } from "@/server/refill";

const AGE = "signal.demographics.age";

describe("the crowd's age as Qloo's age buckets", () => {
  it("maps 25–34 exactly onto 25_to_29 and 30_to_34", () => {
    expect(ageBuckets(25, 34)).toEqual({
      buckets: ["25_to_29", "30_to_34"],
      exact: true,
    });
  });

  it("uses the nearest buckets that contain a range Qloo can't express, and says so", () => {
    expect(ageBuckets(22, 30)).toEqual({
      buckets: ["24_and_younger", "25_to_29", "30_to_34"],
      exact: false,
    });
    expect(ageBuckets(60, 70)).toEqual({
      buckets: ["55_and_older"],
      exact: false,
    });
  });
});

describe("the artist calls", () => {
  it("send the age buckets as signal.demographics.age", async () => {
    const fake = fakeFetch(syntheticQloo);
    const qloo = createQlooClient({
      apiKey: "test-key",
      cache: createMemoryCache(),
      fetch: fake.fetch,
    });
    await qloo.artists({
      signalEntityIds: ["a"],
      popularityMin: 0.8,
      popularityMax: 0.92,
      ages: ["25_to_29", "30_to_34"],
    });
    expect(params(fake.requests[0].url)[AGE]).toBe("25_to_29,30_to_34");
  });

  it("carry the festival's crowd in every artist call a build makes, shown in the trace", async () => {
    const server = syntheticServer();
    const events = await readEvents(server.build());
    const artistCalls = events.flatMap((event) =>
      event.type === "call" &&
      ["baseline_artists", "venue_artists"].includes(event.call.tool)
        ? [event.call]
        : [],
    );
    expect(artistCalls.length).toBeGreaterThan(0);
    for (const call of artistCalls)
      expect(call.params).toContainEqual({
        key: AGE,
        // The trace prints lists with a space after each comma.
        value: "25_to_29, 30_to_34",
      });
    const saved = await server.store.latest(SAGEBRUSH_SOUND.id);
    expect(saved?.context.ages).toEqual(["25_to_29", "30_to_34"]);
  });
});

describe("a refill", () => {
  async function refillRequests(saved: SavedBuild) {
    const cache = createMemoryCache();
    const store = createBuildStore(cache);
    await store.save(saved);
    const fake = fakeFetch(syntheticQloo);
    const qloo = createQlooClient({
      apiKey: "test-key",
      cache,
      fetch: fake.fetch,
    });
    const gone = saved.lineup.acts.find((act) => act.band === "mid")!;
    await readEvents(
      handleRefill({
        festival: SAGEBRUSH_SOUND,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => qloo,
        store,
        body: {
          buildId: saved.id,
          unavailableId: gone.entityId,
          band: "mid",
          anchorVenueId: gone.anchorVenue.entityId,
          excludeIds: saved.lineup.acts.map((act) => act.entityId),
        },
      }),
    );
    return fake.requests.map((request) => params(request.url));
  }

  it("asks for the same crowd as the build it refills", async () => {
    const server = syntheticServer();
    await readEvents(server.build());
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    for (const request of await refillRequests(saved))
      expect(request[AGE]).toBe("25_to_29,30_to_34");
  });

  it("leaves the age out for a build saved before it was sent, so its lifts stay comparable", async () => {
    const server = syntheticServer();
    await readEvents(server.build());
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ages, ...olderContext } = saved.context;
    const requests = await refillRequests({ ...saved, context: olderContext });
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) expect(request[AGE]).toBeUndefined();
  });
});
