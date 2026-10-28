// WS13.3, Daniel's change of 28 October (12:30): a refill on a 2.0 build first takes any act that
// already passes the bar from the rankings the build holds, read from the cache with no call;
// only if none passes does it read a new venue and its control, inside a cap of 5 calls (two
// venues, each with its control). Invented data only.
import { describe, expect, it } from "vitest";
import {
  assembleLineup,
  LOCAL_LIFT_BAR,
  MIN_LIFT,
} from "@/lib/assemble-lineup";
import type { BuildEvent } from "@/lib/build-events";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleRefill, REFILL_CALL_CAP } from "@/server/refill";
import { handleUndercardBuild } from "@/server/undercard-build";
import { assemblyFromSaved } from "@/server/venue-switch";
import {
  fakeFetch,
  HEADLINER_TAGS,
  insightsEntity,
  syntheticId,
  syntheticQloo,
} from "../m2/fake-qloo";
import { readEvents } from "../m3/scripted";
import {
  LANTERN,
  LARKSPUR_FESTIVAL,
  OPENING,
  read,
  scriptedModel,
  type Turn,
} from "./agent-kit";

const PLAN: Turn[] = [
  ...OPENING,
  [read("mid", LANTERN), read("opener", LANTERN)],
  [
    {
      name: "finish",
      input: {
        anchor_venue_ids: [LANTERN],
        summary: "One venue filled both tiers.",
        stopped_because: "every_band_full",
      },
    },
  ],
];

async function twoPointOh() {
  const cache = createMemoryCache();
  const store = createBuildStore(cache);
  const qloo = createQlooClient({
    apiKey: "k",
    cache,
    fetch: fakeFetch(syntheticQloo).fetch,
  });
  await readEvents(
    handleUndercardBuild({
      festival: LARKSPUR_FESTIVAL,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      store,
      fresh: true,
      qloo: () => qloo,
      model: () => scriptedModel(PLAN).model,
    }),
  );
  const saved = (await store.latest(LARKSPUR_FESTIVAL.id))!;
  const cached = createQlooClient({
    apiKey: "k",
    cache,
    cacheOnly: true,
    fetch: () => {
      throw new Error("the held rankings are read from the cache only");
    },
  });
  return { saved, store, cache, cached };
}

/** The mid-size acts that pass the 2.0 rule in the rankings the build holds, in its order. */
async function heldPassing(
  saved: SavedBuild,
  cached: ReturnType<typeof createQlooClient>,
) {
  const input = (await assemblyFromSaved(saved, LARKSPUR_FESTIVAL, cached))!;
  const mid = LARKSPUR_FESTIVAL.feeBands.find((band) => band.id === "mid")!;
  return assembleLineup({ ...input, bands: [{ ...mid, slots: 50 }] }).acts;
}

const refill = (
  saved: SavedBuild,
  store: ReturnType<typeof createBuildStore>,
  qloo: ReturnType<typeof createQlooClient>,
  cached: ReturnType<typeof createQlooClient>,
  excludeIds: string[],
) => {
  const gone = saved.lineup.acts.find((act) => act.band === "mid")!;
  return readEvents(
    handleRefill({
      festival: LARKSPUR_FESTIVAL,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      qloo: () => qloo,
      cachedQloo: () => cached,
      store,
      body: {
        buildId: saved.id,
        unavailableId: gone.entityId,
        band: "mid",
        anchorVenueId: gone.anchorVenue.entityId,
        excludeIds,
      },
    }),
  );
};

const calls = (events: BuildEvent[]) =>
  events.flatMap((event) => (event.type === "call" ? [event.call] : []));
const refilled = (events: BuildEvent[]) =>
  events.flatMap((event) => (event.type === "refill" ? [event.act] : []))[0];

describe("a 2.0 refill (Daniel, 2026-10-28)", () => {
  it("has a cap of 5 calls: two venues, each with its control", () => {
    expect(REFILL_CALL_CAP).toBe(5);
  });

  it("books from the rankings the build holds, with no call, when an act there passes the bar", async () => {
    const { saved, store, cached } = await twoPointOh();
    const board = saved.lineup.acts.map((act) => act.entityId);
    const held = await heldPassing(saved, cached);
    const next = held.find((act) => !board.includes(act.entityId))!;
    expect(next).toBeDefined();
    let asked = 0;
    const live = createQlooClient({
      apiKey: "k",
      cache: createMemoryCache(),
      fetch: async () => {
        asked++;
        throw new Error("the held path makes no call");
      },
    });
    const events = await refill(saved, store, live, cached, board);
    expect(asked).toBe(0);
    expect(calls(events)).toEqual([]);
    const act = refilled(events);
    expect(act?.entityId).toBe(next.entityId);
    expect(board).not.toContain(act!.entityId);
    expect(
      act!.localLift!.venueClimb - act!.localLift!.controlClimb,
    ).toBeGreaterThanOrEqual(LOCAL_LIFT_BAR);
    expect(events.at(-1)).toMatchObject({ type: "done", calls: 0 });
  });

  it("reads a new venue and its control only when no held act passes, and books only above the bar", async () => {
    const { saved, store, cached } = await twoPointOh();
    const board = saved.lineup.acts.map((act) => act.entityId);
    // Every act that passes in the held rankings is already taken: the held path finds none.
    const taken = [
      ...board,
      ...(await heldPassing(saved, cached)).map((act) => act.entityId),
    ];
    // The fresh read of the Lantern Room lists a new act at the top, which the control's answer
    // leaves out (51st there): it clears both bars.
    const FRESH = 9999;
    const route = (url: URL) => {
      const body = syntheticQloo(url) as {
        results?: { entities: unknown[] };
      };
      const signal = url.searchParams.get("signal.interests.entities") ?? "";
      return signal.endsWith(LANTERN) &&
        url.searchParams.get("filter.exclude.entities")?.includes(taken[0])
        ? {
            ...body,
            results: {
              entities: [
                insightsEntity(
                  FRESH,
                  "Fresh Juniper",
                  0.85,
                  0.99,
                  HEADLINER_TAGS.slice(0, 2),
                ),
                ...body.results!.entities,
              ],
            },
          }
        : body;
    };
    const live = createQlooClient({
      apiKey: "k",
      cache: createMemoryCache(),
      fetch: fakeFetch(route).fetch,
    });
    const events = await refill(saved, store, live, cached, taken);
    const made = calls(events);
    expect(made.length).toBeGreaterThanOrEqual(2);
    expect(made.length).toBeLessThanOrEqual(REFILL_CALL_CAP);
    expect(made.some((call) => call.controlFor === "The Lantern Room")).toBe(
      true,
    );
    const act = refilled(events);
    expect(act?.entityId).toBe(syntheticId(FRESH));
    expect(act!.localLift!.venueClimb).toBeGreaterThanOrEqual(MIN_LIFT);
    expect(
      act!.localLift!.venueClimb - act!.localLift!.controlClimb,
    ).toBeGreaterThanOrEqual(LOCAL_LIFT_BAR);
  });
});
