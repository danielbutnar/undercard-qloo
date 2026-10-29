// Daniel's answers of 28 October (13:25): on a 2.0 build, a refill and a redraft first book from
// the rankings the build holds, at no call; only then do they read up to two venues, each with
// its matched control, within 5 calls (1.0 builds keep 3). Here nothing held passes, the first
// venue and its control give no act that passes, and the second venue does: within the old
// 3-call cap the second venue is never read. Invented data only.
import { describe, expect, it } from "vitest";
import { LOCAL_LIFT_BAR, assembleLineup } from "@/lib/assemble-lineup";
import type { BuildEvent } from "@/lib/build-events";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleRedraft, REDRAFT_CALL_CAP } from "@/server/redraft";
import { handleRefill } from "@/server/refill";
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
  FORT,
  LANTERN,
  LARKSPUR_FESTIVAL,
  OPENING,
  read,
  scriptedModel,
  type Turn,
} from "./agent-kit";

// The build reads the Lantern Room for both tiers and Fort Street Ballroom for mid-size acts.
const PLAN: Turn[] = [
  ...OPENING,
  [read("mid", LANTERN), read("opener", LANTERN), read("mid", FORT)],
  [
    {
      name: "finish",
      input: {
        anchor_venue_ids: [LANTERN, FORT],
        summary: "Two venues.",
        stopped_because: "every_band_full",
      },
    },
  ],
];
const HALL = syntheticId(401);
const FRESH = 9999;

async function twoPointOh(
  wrap: (route: (url: URL) => unknown) => (url: URL) => unknown = (route) =>
    route,
) {
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
      throw new Error("the held rankings come from the cache only");
    },
  });
  // Every mid-size act that passes in the held rankings is taken: nothing held is left.
  const input = (await assemblyFromSaved(saved, LARKSPUR_FESTIVAL, cached))!;
  const mid = LARKSPUR_FESTIVAL.feeBands.find((band) => band.id === "mid")!;
  const taken = [
    ...saved.lineup.acts.map((act) => act.entityId),
    ...assembleLineup({ ...input, bands: [{ ...mid, slots: 50 }] }).acts.map(
      (act) => act.entityId,
    ),
  ];
  // The fresh reads leave out the board. The matched control (Aarhus Hall) then ranks acts as
  // the Lantern Room does, so the first venue lifts nothing over it; Fort Street Ballroom's fresh
  // read lists a new act first, which the control leaves out: it clears both bars.
  const route = (url: URL) => {
    const fresh = url.searchParams
      .get("filter.exclude.entities")
      ?.includes(taken[taken.length - 1]);
    const signal = url.searchParams.get("signal.interests.entities") ?? "";
    if (fresh && signal.endsWith(HALL))
      url.searchParams.set(
        "signal.interests.entities",
        signal.replace(HALL, LANTERN),
      );
    const body = syntheticQloo(url) as { results?: { entities: unknown[] } };
    return fresh && signal.endsWith(FORT)
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
    fetch: fakeFetch(wrap(route)).fetch,
    sleep: async () => {},
  });
  return { saved, store, cached, live, taken };
}

const calls = (events: BuildEvent[]) =>
  events.flatMap((event) => (event.type === "call" ? [event.call] : []));

const expectFresh = (act: {
  entityId: string;
  localLift?: { venueClimb: number; controlClimb: number };
}) => {
  expect(act.entityId).toBe(syntheticId(FRESH));
  expect(
    act.localLift!.venueClimb - act.localLift!.controlClimb,
  ).toBeGreaterThanOrEqual(LOCAL_LIFT_BAR);
};

describe("a refill's retries (Daniel, 2026-10-28, 19:20)", () => {
  it("are on its call's line, counted, never silent", async () => {
    // Qloo is busy once, for the refill's first call; the client retries it.
    let first = true;
    const { saved, store, cached, live, taken } = await twoPointOh(
      (route) => (url) => {
        if (first) {
          first = false;
          return new Response("{}", { status: 429 });
        }
        return route(url);
      },
    );
    const gone = saved.lineup.acts.find((act) => act.band === "mid")!;
    const events = await readEvents(
      handleRefill({
        festival: LARKSPUR_FESTIVAL,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => live,
        cachedQloo: () => cached,
        store,
        body: {
          buildId: saved.id,
          unavailableId: gone.entityId,
          band: "mid",
          anchorVenueId: LANTERN,
          excludeIds: taken,
        },
      }),
    );
    const made = calls(events);
    expect(made[0].retried).toEqual([429]);
    expect(made.flatMap((call) => call.retried ?? [])).toEqual([429]);
  });
});

describe("the second venue (Daniel, 2026-10-28, 13:25)", () => {
  it("a refill reads the second venue and its control when the first gives no act that passes", async () => {
    const { saved, store, cached, live, taken } = await twoPointOh();
    const gone = saved.lineup.acts.find((act) => act.band === "mid")!;
    const events = await readEvents(
      handleRefill({
        festival: LARKSPUR_FESTIVAL,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => live,
        cachedQloo: () => cached,
        store,
        body: {
          buildId: saved.id,
          unavailableId: gone.entityId,
          band: "mid",
          anchorVenueId: LANTERN,
          excludeIds: taken,
        },
      }),
    );
    const made = calls(events);
    expect(made).toHaveLength(4);
    expect(made.filter((call) => call.controlFor)).toHaveLength(2);
    // Daniel, 17:10: the control is worded as what it is, never "matched".
    for (const call of made.filter((entry) => entry.controlFor))
      expect(call.summary).toMatch(
        /and Aarhus Hall, a venue in Aarhus with similar Qloo popularity, the control for (The Lantern Room|Fort Street Ballroom), minus the board$/,
      );
    for (const call of made) expect(call.summary).not.toMatch(/matched/i);
    const refill = events.find((event) => event.type === "refill");
    expect(refill?.type).toBe("refill");
    if (refill?.type === "refill") expectFresh(refill.act);
  });

  it("a redraft reads the second venue and its control when the first gives no act that passes", async () => {
    const { saved, store, cached, live, taken } = await twoPointOh();
    const gone = saved.lineup.acts.find((act) => act.band === "mid")!;
    const events = await readEvents(
      handleRedraft({
        festival: LARKSPUR_FESTIVAL,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => live,
        cachedQloo: () => cached,
        store,
        body: {
          buildId: saved.id,
          replace: [{ entityId: gone.entityId, band: "mid" }],
          excludeIds: taken,
        },
      }),
    );
    const made = calls(events);
    expect(made).toHaveLength(4);
    expect(made.length).toBeLessThanOrEqual(REDRAFT_CALL_CAP);
    // Daniel, 17:10: the control is worded as what it is, never "matched".
    expect(made.filter((call) => call.controlFor)).toHaveLength(2);
    for (const call of made.filter((entry) => entry.controlFor))
      expect(call.summary).toMatch(
        /^Redraft: Mid-band artists for the headliners and Aarhus Hall, a venue in Aarhus with similar Qloo popularity, the control for (The Lantern Room|Fort Street Ballroom), minus the board$/,
      );
    for (const call of made) expect(call.summary).not.toMatch(/matched/i);
    const redraft = events.find((event) => event.type === "redraft");
    expect(redraft?.type).toBe("redraft");
    if (redraft?.type === "redraft") {
      expect(redraft.pairs).toHaveLength(1);
      expectFresh(redraft.pairs[0].act);
    }
  });

  it("a redraft books from the rankings the build holds first, with no call", async () => {
    const { saved, store, cached } = await twoPointOh();
    const board = saved.lineup.acts.map((act) => act.entityId);
    const gone = saved.lineup.acts.find((act) => act.band === "mid")!;
    let asked = 0;
    const live = createQlooClient({
      apiKey: "k",
      cache: createMemoryCache(),
      fetch: async () => {
        asked++;
        throw new Error("the held path makes no call");
      },
    });
    const events = await readEvents(
      handleRedraft({
        festival: LARKSPUR_FESTIVAL,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => live,
        cachedQloo: () => cached,
        store,
        body: {
          buildId: saved.id,
          replace: [{ entityId: gone.entityId, band: "mid" }],
          excludeIds: board,
        },
      }),
    );
    expect(asked).toBe(0);
    expect(calls(events)).toEqual([]);
    const redraft = events.find((event) => event.type === "redraft");
    expect(redraft?.type === "redraft" && redraft.pairs).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: "done", calls: 0 });
  });
});
