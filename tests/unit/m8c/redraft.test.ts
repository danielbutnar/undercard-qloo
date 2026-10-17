import { describe, expect, it } from "vitest";
import type { BuildEvent } from "@/lib/build-events";
import { buildReducer, firstBoard } from "@/lib/build-state";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleRedraft, REDRAFT_CALL_CAP } from "@/server/redraft";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents, syntheticServer } from "../m3/scripted";

async function savedBuild() {
  const server = syntheticServer();
  await readEvents(server.build());
  return (await server.store.latest(SAGEBRUSH_SOUND.id))!;
}

function redraftWith(saved: SavedBuild) {
  const cache = createMemoryCache();
  const store = createBuildStore(cache);
  const fake = fakeFetch(syntheticQloo);
  const qloo = createQlooClient({
    apiKey: "test-key",
    cache,
    fetch: fake.fetch,
  });
  return {
    requests: fake.requests,
    run: async (body: unknown) => {
      await store.save(saved);
      return readEvents(
        handleRedraft({
          festival: SAGEBRUSH_SOUND,
          limiter: createMemoryLimiter(),
          ip: "203.0.113.7",
          qloo: () => qloo,
          store,
          body,
        }),
      );
    },
  };
}

const callsOf = (events: BuildEvent[]) =>
  events.flatMap((event) => (event.type === "call" ? [event.call] : []));

describe("redraft the rest (M8c)", () => {
  it("refills every slot not kept, with acts not on the board, in at most 3 Qloo calls", async () => {
    const saved = await savedBuild();
    const acts = saved.lineup.acts;
    const kept = [acts[0], acts[4], acts[5]].map((act) => act.entityId);
    const rest = acts.filter((act) => !kept.includes(act.entityId));
    const { run, requests } = redraftWith(saved);
    const events = await run({
      buildId: saved.id,
      replace: rest.map((act) => ({ entityId: act.entityId, band: act.band })),
      excludeIds: acts.map((act) => act.entityId),
    });
    expect(REDRAFT_CALL_CAP).toBe(3);
    expect(callsOf(events).length).toBeLessThanOrEqual(3);
    expect(requests.length).toBeLessThanOrEqual(3);
    const redraft = events.find((event) => event.type === "redraft");
    expect(redraft).toBeTruthy();
    if (redraft?.type !== "redraft") return;
    expect(redraft.pairs.length).toBeGreaterThan(0);
    for (const { replaces, act } of redraft.pairs) {
      const gone = rest.find((entry) => entry.entityId === replaces)!;
      expect(gone).toBeTruthy();
      expect(act.band).toBe(gone.band);
      expect(acts.map((entry) => entry.entityId)).not.toContain(act.entityId);
    }
    expect(new Set(redraft.pairs.map((pair) => pair.act.entityId)).size).toBe(
      redraft.pairs.length,
    );
  });

  it("never touches a kept or unavailable act", async () => {
    const saved = await savedBuild();
    const acts = saved.lineup.acts;
    const { run } = redraftWith(saved);
    const events = await run({
      buildId: saved.id,
      replace: [{ entityId: acts[1].entityId, band: acts[1].band }],
      excludeIds: acts.map((act) => act.entityId),
    });
    const redraft = events.find((event) => event.type === "redraft");
    if (redraft?.type !== "redraft") throw new Error("no redraft");
    expect(redraft.pairs.map((pair) => pair.replaces)).toEqual([
      acts[1].entityId,
    ]);
  });

  it("refuses a request that names no slot", async () => {
    const saved = await savedBuild();
    const events = await redraftWith(saved).run({
      buildId: saved.id,
      replace: [],
      excludeIds: [],
    });
    expect(events.find((event) => event.type === "error")).toBeTruthy();
    expect(callsOf(events)).toHaveLength(0);
  });
});

describe("the board's keeps", () => {
  it("toggle, and a redraft swaps only the slots it names", async () => {
    const saved = await savedBuild();
    let state = firstBoard({
      acts: saved.lineup.acts,
      build: { id: saved.id, createdAt: saved.createdAt },
    } as never);
    const [first, second] = saved.lineup.acts;
    state = buildReducer(state, {
      type: "toggleKeep",
      entityId: first.entityId,
    });
    expect(state.keeping).toEqual([first.entityId]);
    state = buildReducer(state, {
      type: "toggleKeep",
      entityId: second.entityId,
    });
    state = buildReducer(state, {
      type: "toggleKeep",
      entityId: second.entityId,
    });
    expect(state.keeping).toEqual([first.entityId]);
    state = buildReducer(state, { type: "startRedraft" });
    expect(state.redrafting).toBe(true);
    const fresh = { ...second, entityId: "new-act", name: "New Act" };
    state = buildReducer(state, {
      type: "refillEvent",
      event: {
        type: "redraft",
        pairs: [{ replaces: second.entityId, act: fresh }],
      },
    });
    state = buildReducer(state, {
      type: "refillEvent",
      event: { type: "done", calls: 2, ms: 10 },
    });
    expect(state.acts[0]).toEqual(first);
    expect(state.acts[1].entityId).toBe("new-act");
    expect(state.redrafting).toBe(false);
    expect(state.keeping).toEqual([first.entityId]);
  });
});
