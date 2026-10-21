// Live runs no longer replace the saved builds every visitor sees (Daniel's brief of 2026-10-21,
// night). A festival's first complete build stays the one its first screen, How it works and the
// venue switch read; a later live run is saved under its own id only, so whoever ran it keeps
// their own lineup. Everything here is invented data.
import { describe, expect, it } from "vitest";
import type { BuildEvent } from "@/lib/build-events";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import type { Festival } from "@/lib/festival";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { checkedFestival } from "@/lib/towns";
import { switchedLineup } from "@/lib/venue-switch";
import { yourFestival } from "@/lib/your-festival";
import {
  createBuildStore,
  type BuildStore,
  type SavedBuild,
} from "@/server/build-store";
import { readFirstBill } from "@/server/first-bill";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";
import { readVenueSwitch } from "@/server/venue-switch";
import { readEvents, scriptedPlanner, syntheticServer } from "../m3/scripted";

type Server = ReturnType<typeof syntheticServer>;

/** A live run, as "Run the agent live instead" asks for one, with a planner of its own. */
async function liveRun(
  server: Server,
  {
    festival = SAGEBRUSH_SOUND,
    save = true,
    store = server.store,
  }: { festival?: Festival; save?: boolean; store?: BuildStore } = {},
) {
  const planner = scriptedPlanner();
  const events = await readEvents(
    handleUndercardBuild({
      festival,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      qloo: () => server.qloo,
      model: () => planner.model,
      store,
      fresh: true,
      save,
      replayDelayMs: 0,
    }),
  );
  return { events, ...runOf(events) };
}

function runOf(events: BuildEvent[]) {
  let id = "";
  let replayed: boolean | null = null;
  let acts: SavedBuild["lineup"]["acts"] = [];
  for (const event of events) {
    if (event.type === "build") ({ id, replayed } = event);
    if (event.type === "lineup") acts = event.lineup.acts;
  }
  return {
    id,
    replayed,
    acts,
    calls: events.filter((event) => event.type === "call").length,
    errors: events.filter((event) => event.type === "error"),
  };
}

/** The smallest saved build that parses, for the store on its own. */
const savedBuild = (festivalId: string, id: string): SavedBuild => ({
  id,
  festivalId,
  createdAt: "2026-10-17T12:13:00.000Z",
  trace: [],
  lineup: { festivalId, acts: [] },
  context: { headliners: [], comparedTags: [], baselines: {}, anchors: {} },
});

const cacheOnly = (server: Server) =>
  createQlooClient({
    apiKey: "k",
    cache: server.cache,
    fetch: () => {
      throw new Error("the venue switch must not call Qloo");
    },
    cacheOnly: true,
  });

describe("(a) a complete live run for a festival that already has a saved build", () => {
  it("is saved under its own id, and latest() still returns the saved build", async () => {
    const server = syntheticServer();
    const first = await liveRun(server);
    const run = await liveRun(server);
    // A complete run, the kind that is saved: both bands full, no error.
    expect(run.acts).toHaveLength(10);
    expect(run.errors).toEqual([]);
    expect(run.id).not.toBe(first.id);
    expect((await server.store.byId(run.id))?.festivalId).toBe(
      SAGEBRUSH_SOUND.id,
    );
    expect((await server.store.latest(SAGEBRUSH_SOUND.id))?.id).toBe(first.id);
  });

  it("leaves the first screen and How it works on the saved build", async () => {
    const server = syntheticServer();
    const first = await liveRun(server);
    await liveRun(server);
    const bill = await readFirstBill(server.store, SAGEBRUSH_SOUND.id);
    expect(bill?.build.id).toBe(first.id);
    expect(methodStory(SAGEBRUSH_SOUND, bill)?.buildId).toBe(first.id);
  });

  it("holds for Sagebrush Sound and every checked town's festival", async () => {
    const store = createBuildStore(createMemoryCache());
    const festivals = CHECKED_TOWNS.map(checkedFestival);
    expect(new Set(festivals.map((festival) => festival.id)).size).toBe(29);
    expect(festivals).toContain(SAGEBRUSH_SOUND);
    for (const { id } of festivals) {
      await store.save(savedBuild(id, `${id}-saved`));
      await store.save(savedBuild(id, `${id}-live`));
      expect((await store.latest(id))?.id).toBe(`${id}-saved`);
      expect((await store.byId(`${id}-live`))?.festivalId).toBe(id);
    }
  });
});

describe("(b) a festival with no saved build", () => {
  it("still gets its first complete build as latest", async () => {
    const server = syntheticServer();
    const first = await liveRun(server);
    expect(first.acts).toHaveLength(10);
    expect((await server.store.latest(SAGEBRUSH_SOUND.id))?.id).toBe(first.id);
  });

  it("gets it from Build undercard on the empty board too", async () => {
    const server = syntheticServer();
    const first = runOf(await readEvents(server.build()));
    expect(first.replayed).toBe(false);
    expect((await server.store.latest(SAGEBRUSH_SOUND.id))?.id).toBe(first.id);
  });

  it("counts a pointer to a build no longer stored as none, so the next complete build takes its place", async () => {
    const server = syntheticServer();
    await server.cache.set(
      "undercard:build:v1:latest:sagebrush-sound",
      "expired",
      60,
    );
    const first = await liveRun(server);
    expect((await server.store.latest(SAGEBRUSH_SOUND.id))?.id).toBe(first.id);
  });
});

describe("(c) the live run's own id", () => {
  it("still serves the run's own record and venue switch, so whoever ran it keeps their lineup", async () => {
    const server = syntheticServer();
    const first = await liveRun(server);
    const run = await liveRun(server);
    // The record its refill, redraft and running order read: the run's own calls and lineup.
    const kept = await server.store.byId(run.id);
    expect(kept?.lineup.acts).toEqual(run.acts);
    expect(kept?.trace).toHaveLength(run.calls);

    const mine = await readVenueSwitch({
      store: server.store,
      festival: SAGEBRUSH_SOUND,
      qloo: cacheOnly(server),
      buildId: run.id,
    });
    expect(mine?.buildId).toBe(run.id);
    const every = new Set(mine!.venues.map((venue) => venue.entityId));
    expect(switchedLineup(mine!, every).acts).toEqual(run.acts);

    // A visitor with no build of their own still gets the saved build's switch.
    const visitor = await readVenueSwitch({
      store: server.store,
      festival: SAGEBRUSH_SOUND,
      qloo: cacheOnly(server),
    });
    expect(visitor?.buildId).toBe(first.id);
  });
});

describe("(d) a judge's own brief", () => {
  it("still saves nothing, under any id, and moves no festival's saved build", async () => {
    const server = syntheticServer();
    const first = await liveRun(server);
    const written: string[] = [];
    const watched: QlooCache = {
      ...server.cache,
      set: async (key, value, ttl) => {
        written.push(key);
        await server.cache.set(key, value, ttl);
      },
    };
    const festival = yourFestival(
      {
        city: SAGEBRUSH_SOUND.city,
        region: SAGEBRUSH_SOUND.region,
        headliners: [...SAGEBRUSH_SOUND.headliners],
      },
      "yours-test",
    );
    const run = await liveRun(server, {
      festival,
      save: false,
      store: createBuildStore(watched),
    });
    expect(run.acts.length).toBeGreaterThan(0);
    expect(written.filter((key) => key.startsWith("undercard:build:"))).toEqual(
      [],
    );
    expect(await server.store.byId(run.id)).toBeNull();
    expect(await server.store.latest(festival.id)).toBeNull();
    expect((await server.store.latest(SAGEBRUSH_SOUND.id))?.id).toBe(first.id);
  });
});
