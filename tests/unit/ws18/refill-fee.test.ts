// WS18 item 3 (Daniel, 29 Oct): the fee steers the refill. A replacement for "fee" must also sit
// below the replaced act's popularity, in the same tier; if none does, the refill takes the
// strongest that passes and says so, for the receipt. Routing and a radius clause steer nothing.
// The refill also says the replacement's place in its venue's ranking, for the receipt.
// Invented data only.
import { describe, expect, it } from "vitest";
import { assembleLineup } from "@/lib/assemble-lineup";
import type { BuildEvent } from "@/lib/build-events";
import { billPlaces } from "@/lib/places";
import type { UnavailableReason } from "@/lib/unavailable";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient, type QlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
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
  LANTERN,
  LARKSPUR_FESTIVAL,
  OPENING,
  read,
  scriptedModel,
  type Turn,
} from "../ws13/agent-kit";

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

/** A 2.0 build saved by the agent on synthetic Qloo, and a reader of its cached rankings. */
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
  // The mid-size acts that pass the rule in the rankings the build holds, strongest first, and
  // aren't on the bill.
  const input = (await assemblyFromSaved(saved, LARKSPUR_FESTIVAL, cached))!;
  const mid = LARKSPUR_FESTIVAL.feeBands.find((band) => band.id === "mid")!;
  const board = saved.lineup.acts.map((act) => act.entityId);
  const open = assembleLineup({
    ...input,
    bands: [{ ...mid, slots: 50 }],
  }).acts.filter((act) => !board.includes(act.entityId));
  return { saved, store, cached, board, open };
}

type Build = Awaited<ReturnType<typeof twoPointOh>>;

/** No call reaches Qloo: these refills come from the rankings already read. */
const noCalls = () =>
  createQlooClient({
    apiKey: "k",
    cache: createMemoryCache(),
    fetch: () => {
      throw new Error("this refill comes from the rankings already read");
    },
  });

/** A refill of the bill's first mid-size act. */
async function refill(
  { saved, store, cached, board }: Build,
  body: {
    reason?: UnavailableReason;
    popularity?: number;
    excludeIds?: string[];
  },
  qloo: QlooClient = noCalls(),
) {
  const gone = saved.lineup.acts.find((act) => act.band === "mid")!;
  const events = await readEvents(
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
        excludeIds: board,
        ...body,
      },
    }),
  );
  const event = events.find(
    (entry): entry is Extract<BuildEvent, { type: "refill" }> =>
      entry.type === "refill",
  );
  return { gone, event, done: events.at(-1) };
}

describe("a fee refill (WS18 item 3)", () => {
  it("takes the strongest act below the replaced act's popularity, in the same tier", async () => {
    const build = await twoPointOh();
    // Every act that passes in the held rankings is taken, so the refill reads the venue again:
    // its fresh answer leads with a strong act above 0.85 and a cheaper one just under it.
    const taken = [...build.board, ...build.open.map((act) => act.entityId)];
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
                  9998,
                  "Fresh Juniper",
                  0.9,
                  0.99,
                  HEADLINER_TAGS.slice(0, 2),
                ),
                insightsEntity(
                  9999,
                  "Fresh Sorrel",
                  0.81,
                  0.98,
                  HEADLINER_TAGS.slice(0, 2),
                ),
                ...body.results!.entities,
              ],
            },
          }
        : body;
    };
    const live = () =>
      createQlooClient({
        apiKey: "k",
        cache: createMemoryCache(),
        fetch: fakeFetch(route).fetch,
      });
    const steered = await refill(
      build,
      { reason: "fee", popularity: 0.85, excludeIds: taken },
      live(),
    );
    expect(steered.event?.act.entityId).toBe(syntheticId(9999));
    expect(steered.event?.act.band).toBe("mid");
    expect(steered.event?.feeFallback).toBeUndefined();
    // Routing isn't about the fee: the strongest act takes the slot.
    const routed = await refill(
      build,
      { reason: "routing", popularity: 0.85, excludeIds: taken },
      live(),
    );
    expect(routed.event?.act.entityId).toBe(syntheticId(9998));
  });

  it("takes the strongest act that passes when none sits below, and says so", async () => {
    const build = await twoPointOh();
    // The bill's first mid-size act is the cheapest in its tier: no open act sits below it. The
    // request doesn't say its popularity; the saved bill does.
    const { gone, event, done } = await refill(build, { reason: "fee" });
    expect(build.open.every((act) => act.popularity >= gone.popularity)).toBe(
      true,
    );
    expect(event?.act.entityId).toBe(build.open[0].entityId);
    expect(event?.feeFallback).toBe(true);
    expect(done).toMatchObject({ type: "done", calls: 0 });
  });

  it("doesn't say so when the strongest act sits below anyway", async () => {
    const build = await twoPointOh();
    const { event } = await refill(build, {
      reason: "fee",
      popularity: Math.max(...build.open.map((act) => act.popularity)),
    });
    expect(event?.act.entityId).toBe(build.open[0].entityId);
    expect(event?.feeFallback).toBeUndefined();
  });

  it("isn't steered by routing or a radius clause", async () => {
    const build = await twoPointOh();
    for (const reason of ["routing", "radius"] as const) {
      const { event } = await refill(build, { reason, popularity: 0 });
      expect(event?.act.entityId).toBe(build.open[0].entityId);
      expect(event?.feeFallback).toBeUndefined();
    }
  });

  it("says the replacement's place in its venue's ranking, as the first bill reads it", async () => {
    const build = await twoPointOh();
    const { event } = await refill(build, { reason: "routing" });
    const place = billPlaces([event!.act], build.saved.context.baselines)[
      event!.act.entityId
    ];
    expect(place).toBeDefined();
    expect(event?.place).toEqual(place);
  });
});
