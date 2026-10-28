// WS13.3, MUST-FIX (Daniel, 28 October): an Unavailable refill and "Redraft the rest" on a 2.0
// build use the 2.0 rule: the climb of 5 with the town's venue AND the local lift of 5 over the
// venue's matched control, read with the same acts left out. A refill never books an act below
// the bar. Invented data only.
import { describe, expect, it } from "vitest";
import type { BuildEvent } from "@/lib/build-events";
import { LOCAL_LIFT_BAR } from "@/lib/assemble-lineup";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleRedraft } from "@/server/redraft";
import { handleRefill } from "@/server/refill";
import { handleUndercardBuild } from "@/server/undercard-build";
import { fakeFetch, syntheticId, syntheticQloo } from "../m2/fake-qloo";
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

/** Aarhus Hall, the matched control, ranks every act exactly as the Lantern Room does. */
const controlAsVenue = (url: URL) => {
  const signal = url.searchParams.get("signal.interests.entities") ?? "";
  if (signal.endsWith(syntheticId(401)))
    url.searchParams.set(
      "signal.interests.entities",
      signal.replace(syntheticId(401), LANTERN),
    );
  return syntheticQloo(url);
};

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
  expect(saved.context.controls).toBeDefined();
  // Later calls answer from `route`, as a refill's own calls are new ones.
  const client = (route: (url: URL) => unknown) =>
    createQlooClient({ apiKey: "k", cache, fetch: fakeFetch(route).fetch });
  return { saved, store, client };
}

const refillBody = (saved: SavedBuild) => {
  const gone = saved.lineup.acts.find((act) => act.band === "mid")!;
  return {
    buildId: saved.id,
    unavailableId: gone.entityId,
    band: "mid",
    anchorVenueId: gone.anchorVenue.entityId,
    excludeIds: saved.lineup.acts.map((act) => act.entityId),
  };
};

const calls = (events: BuildEvent[]) =>
  events.flatMap((event) => (event.type === "call" ? [event.call] : []));

describe("a refill on a 2.0 build (WS13.3)", () => {
  it("never books an act below the local-lift bar", async () => {
    const { saved, store, client } = await twoPointOh();
    const qloo = client(controlAsVenue);
    const events = await readEvents(
      handleRefill({
        festival: LARKSPUR_FESTIVAL,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => qloo,
        store,
        body: refillBody(saved),
      }),
    );
    // Every act's climb with the control equals its climb with the venue: none clears the bar.
    expect(events.some((event) => event.type === "refill")).toBe(false);
    expect(events.some((event) => event.type === "error")).toBe(true);
    // It read the matched control, with the board left out, inside the 3 calls.
    const made = calls(events);
    expect(made.length).toBeLessThanOrEqual(3);
    expect(made.some((call) => call.summary.includes("Aarhus Hall"))).toBe(
      true,
    );
  });

  it("books an act that clears the bar, carrying both climbs", async () => {
    const { saved, store, client } = await twoPointOh();
    const qloo = client(syntheticQloo);
    const events = await readEvents(
      handleRefill({
        festival: LARKSPUR_FESTIVAL,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => qloo,
        store,
        body: refillBody(saved),
      }),
    );
    const refill = events.find((event) => event.type === "refill");
    expect(refill?.type === "refill" && refill.act.localLift).toBeTruthy();
    if (refill?.type === "refill") {
      const { venueClimb, controlClimb } = refill.act.localLift!;
      expect(venueClimb - controlClimb).toBeGreaterThanOrEqual(LOCAL_LIFT_BAR);
    }
  });
});

describe("a redraft on a 2.0 build (WS13.3)", () => {
  it("never books an act below the local-lift bar", async () => {
    const { saved, store, client } = await twoPointOh();
    const qloo = client(controlAsVenue);
    const replace = saved.lineup.acts
      .filter((act) => act.band === "mid")
      .map((act) => ({ entityId: act.entityId, band: act.band }));
    const events = await readEvents(
      handleRedraft({
        festival: LARKSPUR_FESTIVAL,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => qloo,
        store,
        body: {
          buildId: saved.id,
          replace,
          excludeIds: saved.lineup.acts.map((act) => act.entityId),
        },
      }),
    );
    const redraft = events.find((event) => event.type === "redraft");
    expect(redraft?.type === "redraft" ? redraft.pairs : []).toEqual([]);
    expect(calls(events).length).toBeLessThanOrEqual(3);
  });
});
