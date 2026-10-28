// WS13: Agent 2.0's builds read and write their own cache prefix, record it, and their replay and
// venue switch read it back, with the scored venue reads; nothing a 2.0 build asks is written
// under the prefix the saved 1.0 builds read (Daniel, 2026-10-24). Invented data only.
import { describe, expect, it } from "vitest";
import { switchedLineup } from "@/lib/venue-switch";
import { createBuildStore } from "@/server/build-store";
import {
  AGENT_CACHE_PREFIX,
  createQlooClient,
  QLOO_CACHE_PREFIX,
} from "@/server/qloo";
import { createMemoryCache, type QlooCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild, replayClimbs } from "@/server/undercard-build";
import { readVenueSwitch } from "@/server/venue-switch";
import { readEvents } from "../m3/scripted";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import {
  finish,
  FORT,
  HALL,
  LANTERN,
  LARKSPUR_FESTIVAL,
  OPENING,
  read,
  scriptedModel,
} from "./agent-kit";

const PLAN = [
  ...OPENING,
  [
    read("mid", LANTERN),
    read("opener", LANTERN),
    read("mid", HALL),
    read("opener", HALL),
  ],
  [read("mid", FORT), read("opener", FORT)],
  finish([LANTERN, FORT]),
];

/** A cache that remembers every key written to it. */
function writesOf(cache: QlooCache) {
  const keys: string[] = [];
  const recording: QlooCache = {
    kind: cache.kind,
    get: (key) => cache.get(key),
    set: (key, value, ttl) => (keys.push(key), cache.set(key, value, ttl)),
  };
  return { recording, keys };
}

async function savedTwoPointOh() {
  const cache = createMemoryCache();
  const { recording, keys } = writesOf(cache);
  const fake = fakeFetch(syntheticQloo);
  const store = createBuildStore(recording);
  const agentQloo = createQlooClient({
    apiKey: "test-key",
    cache: recording,
    fetch: fake.fetch,
    prefix: AGENT_CACHE_PREFIX,
  });
  await readEvents(
    handleUndercardBuild({
      festival: LARKSPUR_FESTIVAL,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      store,
      fresh: true,
      qloo: () => agentQloo,
      model: () => scriptedModel(PLAN).model,
    }),
  );
  const saved = await store.latest(LARKSPUR_FESTIVAL.id);
  const cacheOnly = createQlooClient({
    apiKey: "k",
    cache,
    fetch: () => {
      throw new Error("a replay must not call Qloo");
    },
    cacheOnly: true,
  });
  return { saved, keys, cacheOnly, store, requests: fake.requests };
}

describe("a 2.0 build's own cache prefix (WS13)", () => {
  it("records that it is a 2.0 build and the prefix it read", async () => {
    const { saved } = await savedTwoPointOh();
    expect(saved).not.toBeNull();
    expect(saved!.engine).toBe(2);
    expect(saved!.cachePrefix).toBe(AGENT_CACHE_PREFIX);
  });

  it("writes no Qloo answer under the 1.0 builds' prefix", async () => {
    const { keys } = await savedTwoPointOh();
    const qlooKeys = keys.filter((key) => key.startsWith("qloo:"));
    expect(qlooKeys.length).toBeGreaterThan(0);
    expect(qlooKeys.some((key) => key.startsWith(QLOO_CACHE_PREFIX))).toBe(
      false,
    );
    expect(qlooKeys.every((key) => key.startsWith(AGENT_CACHE_PREFIX))).toBe(
      true,
    );
  });

  it("replays its climbs from its own prefix, a step for every ranking, with no Qloo call", async () => {
    const { saved, cacheOnly, requests } = await savedTwoPointOh();
    const before = requests.length;
    const climbs = await replayClimbs(saved!, LARKSPUR_FESTIVAL, cacheOnly);
    const rankings = saved!.trace.filter(
      (call) =>
        call.tool === "baseline_artists" || call.tool === "venue_artists",
    );
    expect(climbs.size).toBe(rankings.length);
    expect(requests).toHaveLength(before);
  });

  it("rebuilds its venue switch from its own prefix, equal to the saved lineup with every venue on", async () => {
    const { saved, cacheOnly, store } = await savedTwoPointOh();
    const data = await readVenueSwitch({
      store,
      festival: LARKSPUR_FESTIVAL,
      qloo: cacheOnly,
      buildId: saved!.id,
    });
    expect(data).not.toBeNull();
    const every = new Set(data!.venues.map((venue) => venue.entityId));
    expect(every.has(HALL)).toBe(true);
    expect(switchedLineup(data!, every).acts).toEqual(saved!.lineup.acts);
  });
});
