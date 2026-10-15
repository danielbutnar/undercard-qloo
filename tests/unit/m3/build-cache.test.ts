import { describe, expect, it } from "vitest";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore } from "@/server/build-store";
import { createMemoryCache } from "@/server/qloo-cache";
import { handleUndercardBuild } from "@/server/undercard-build";
import { readEvents, syntheticServer } from "./scripted";

const acts = (events: Awaited<ReturnType<typeof readEvents>>) =>
  events.flatMap((event) => (event.type === "lineup" ? event.lineup.acts : []));

describe("saved builds", () => {
  it("saves a complete build with its lineup and the context a refill needs", async () => {
    const server = syntheticServer();
    const events = await readEvents(server.build());
    expect(events[0]).toMatchObject({ type: "build", replayed: false });
    const saved = await server.store.latest(SAGEBRUSH_SOUND.id);
    expect(saved?.lineup.acts).toHaveLength(10);
    expect(saved?.trace).toHaveLength(11);
    expect(saved?.context.headliners.map((h) => h.name)).toEqual([
      "Khruangbin",
      "Japanese Breakfast",
    ]);
    expect(saved?.context.baselines.mid).toHaveLength(50);
    expect(saved?.context.anchors.opener?.map((venue) => venue.name)).toEqual([
      "The Lantern Room",
      "Fort Street Ballroom",
    ]);
  });

  it("replays the saved build without calling the planner or Qloo, in under 5 seconds", async () => {
    const server = syntheticServer();
    const first = await readEvents(server.build());
    const turnsAfterFirst = server.planner.turns();
    const requestsAfterFirst = server.requests.length;

    const started = Date.now();
    const replay = await readEvents(server.build());
    expect(Date.now() - started).toBeLessThan(5000);

    expect(server.planner.turns()).toBe(turnsAfterFirst);
    expect(server.requests).toHaveLength(requestsAfterFirst);
    expect(replay[0]).toMatchObject({ type: "build", replayed: true });
    const calls = replay.flatMap((event) =>
      event.type === "call" ? [event.call] : [],
    );
    expect(calls).toHaveLength(11);
    expect(calls.every((call) => call.cached)).toBe(true);
    expect(acts(replay)).toEqual(acts(first));
    expect(replay.at(-1)).toMatchObject({ type: "done", calls: 11 });
  });

  it("runs the agent again when a fresh build is asked for", async () => {
    const server = syntheticServer();
    await readEvents(server.build());
    const turns = server.planner.turns();
    const fresh = await readEvents(server.build({ fresh: true }));
    expect(server.planner.turns()).toBeGreaterThan(turns);
    expect(fresh[0]).toMatchObject({ type: "build", replayed: false });
  });

  it("doesn't save a build that ended in an error", async () => {
    const cache = createMemoryCache();
    const store = createBuildStore(cache);
    await readEvents(
      handleUndercardBuild({
        festival: SAGEBRUSH_SOUND,
        qloo: () => null,
        model: () => null,
        store,
        fresh: false,
      }),
    );
    expect(await store.latest(SAGEBRUSH_SOUND.id)).toBeNull();
  });

  it("ignores a saved build it can't read", async () => {
    const cache = createMemoryCache();
    const store = createBuildStore(cache);
    await cache.set("undercard:build:v1:latest:sagebrush-sound", "broken", 60);
    await cache.set(
      "undercard:build:v1:id:broken",
      { lineup: "not a lineup" },
      60,
    );
    expect(await store.latest(SAGEBRUSH_SOUND.id)).toBeNull();
  });

  it("keeps saved builds until at least 2026-11-18", async () => {
    const ttls: number[] = [];
    const cache = {
      ...createMemoryCache(),
      set: async (_key: string, _value: unknown, ttl: number) =>
        void ttls.push(ttl),
    };
    const writtenAt = Date.UTC(2026, 9, 15, 12);
    const server = syntheticServer();
    const saved = await (async () => {
      await readEvents(server.build());
      return server.store.latest(SAGEBRUSH_SOUND.id);
    })();
    await createBuildStore(cache, () => writtenAt).save(saved!);
    expect(ttls.length).toBeGreaterThan(0);
    for (const ttl of ttls)
      expect(writtenAt + ttl * 1000).toBeGreaterThanOrEqual(
        Date.UTC(2026, 10, 19),
      );
  });
});
