import { describe, expect, it } from "vitest";
import type { BuildEvent } from "@/lib/build-events";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient, QlooCacheMiss } from "@/server/qloo";
import { handleUndercardBuild } from "@/server/undercard-build";
import { createMemoryLimiter } from "@/server/rate-limit";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents, syntheticServer } from "../m3/scripted";

const climbs = (events: BuildEvent[]) =>
  events.filter((event) => event.type === "climb");

describe("a cache-only Qloo client (M9a)", () => {
  it("answers from the cache and never fetches on a miss", async () => {
    const fake = fakeFetch(syntheticQloo);
    const qloo = createQlooClient({
      apiKey: "k",
      cache: createMemoryCache(),
      fetch: fake.fetch,
      cacheOnly: true,
    });
    await expect(qloo.search({ query: "Khruangbin" })).rejects.toBeInstanceOf(
      QlooCacheMiss,
    );
    expect(fake.requests).toHaveLength(0);
  });
});

describe("the climb in a build's stream", () => {
  it("comes with each band's baseline and each venue's run in a live build", async () => {
    const server = syntheticServer();
    const events = await readEvents(server.build({ fresh: true }));
    const steps = climbs(events);
    // One baseline per band, and one step per venue run (2 venues x 2 bands).
    expect(
      steps.filter((s) => s.type === "climb" && s.venue === null),
    ).toHaveLength(2);
    expect(
      steps.filter((s) => s.type === "climb" && s.venue !== null),
    ).toHaveLength(4);
    const lifted = steps
      .flatMap((s) => (s.type === "climb" ? s.acts : []))
      .filter((a) => a.move !== null);
    expect(lifted.length).toBeGreaterThan(0);
  });

  it("is rebuilt in a replay from the Qloo cache, with no new Qloo call", async () => {
    const server = syntheticServer();
    await readEvents(server.build({ fresh: true }));
    const before = server.requests.length;
    const cachedOnly = createQlooClient({
      apiKey: "k",
      cache: server.cache,
      fetch: () => {
        throw new Error("a replay must not call Qloo");
      },
      cacheOnly: true,
    });
    const events = await readEvents(
      handleUndercardBuild({
        festival: SAGEBRUSH_SOUND,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => server.qloo,
        cachedQloo: () => cachedOnly,
        model: () => server.planner.model,
        store: server.store,
        fresh: false,
        replayDelayMs: 0,
      }),
    );
    expect(events.find((e) => e.type === "build")).toMatchObject({
      replayed: true,
    });
    expect(climbs(events)).toHaveLength(6);
    expect(server.requests.length).toBe(before);
    // Each climb follows the call it comes from.
    const firstClimb = events.findIndex((e) => e.type === "climb");
    expect(events[firstClimb - 1]).toMatchObject({
      type: "call",
      call: { tool: "baseline_artists" },
    });
  });

  it("is simply left out of a replay when the cache has nothing", async () => {
    const server = syntheticServer();
    await readEvents(server.build({ fresh: true }));
    const empty = createQlooClient({
      apiKey: "k",
      cache: createMemoryCache(),
      cacheOnly: true,
    });
    const events = await readEvents(
      handleUndercardBuild({
        festival: SAGEBRUSH_SOUND,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => server.qloo,
        cachedQloo: () => empty,
        model: () => server.planner.model,
        store: server.store,
        fresh: false,
        replayDelayMs: 0,
      }),
    );
    expect(climbs(events)).toHaveLength(0);
    expect(events.some((e) => e.type === "lineup")).toBe(true);
  });
});
