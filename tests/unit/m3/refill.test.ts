import { describe, expect, it } from "vitest";
import type { BuildEvent } from "@/lib/build-events";
import { feeBandFor } from "@/lib/fee-bands";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { handleRefill, ONE_POINT_OH_REFILL_CAP } from "@/server/refill";
import { createMemoryLimiter } from "@/server/rate-limit";
import { fakeFetch, params, syntheticId, syntheticQloo } from "../m2/fake-qloo";
import { LANTERN, readEvents, syntheticServer } from "./scripted";

const HEADLINERS = [syntheticId(1), syntheticId(2)];

async function savedBuild() {
  const server = syntheticServer();
  await readEvents(server.build());
  const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
  return { server, saved };
}

function refillWith(
  saved: SavedBuild,
  route: (url: URL) => unknown = syntheticQloo,
) {
  const cache = createMemoryCache();
  const store = createBuildStore(cache);
  const fake = fakeFetch(route);
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
        handleRefill({
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

const refillOf = (events: BuildEvent[]) =>
  events.find((event) => event.type === "refill");
const callsOf = (events: BuildEvent[]) =>
  events.flatMap((event) => (event.type === "call" ? [event.call] : []));

describe("refill", () => {
  it("replaces an unavailable act with another act from the same fee band", async () => {
    const { saved } = await savedBuild();
    const gone = saved.lineup.acts.find((act) => act.band === "mid")!;
    const board = saved.lineup.acts.map((act) => act.entityId);
    const { run } = refillWith(saved);
    const events = await run({
      buildId: saved.id,
      unavailableId: gone.entityId,
      band: "mid",
      anchorVenueId: gone.anchorVenue.entityId,
      excludeIds: board,
    });

    const refill = refillOf(events);
    expect(refill?.type).toBe("refill");
    if (refill?.type !== "refill") return;
    expect(refill.replaces).toBe(gone.entityId);
    expect(refill.act.band).toBe("mid");
    expect(
      feeBandFor(refill.act.popularity, SAGEBRUSH_SOUND.feeBands)?.id,
    ).toBe("mid");
    expect(board).not.toContain(refill.act.entityId);
    expect(refill.act.reason).toContain(refill.act.anchorVenue.name);
    expect(refill.act.sharedTags).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("asks Qloo with filter.exclude.entities covering the headliners and the whole board, anchor venue first", async () => {
    const { saved } = await savedBuild();
    const gone = saved.lineup.acts.find(
      (act) => act.band === "opener" && act.anchorVenue.entityId === LANTERN,
    )!;
    const board = saved.lineup.acts.map((act) => act.entityId);
    const { run, requests } = refillWith(saved);
    const events = await run({
      buildId: saved.id,
      unavailableId: gone.entityId,
      band: "opener",
      anchorVenueId: LANTERN,
      excludeIds: board,
    });

    const sent = params(requests[0].url);
    expect(requests[0].url.pathname).toBe("/v2/insights");
    expect(sent["filter.type"]).toBe("urn:entity:artist");
    expect(sent["signal.interests.entities"]).toBe(
      [...HEADLINERS, LANTERN].join(","),
    );
    expect(sent["filter.popularity.min"]).toBe("0.55");
    expect(sent["filter.popularity.max"]).toBe("0.8");
    expect(sent["filter.exclude.entities"].split(",").sort()).toEqual(
      [...HEADLINERS, ...board].sort(),
    );
    const [call] = callsOf(events);
    expect(call).toMatchObject({
      n: 1,
      tool: "refill",
      endpoint: "/v2/insights",
      resultCount: 50,
    });
    expect(call.summary).toBe(
      "Refill: Opener-band artists for the headliners and The Lantern Room, minus the board",
    );
  });

  it(`stops after ${ONE_POINT_OH_REFILL_CAP} Qloo calls on a 1.0 build when no venue lifts a replacement`, async () => {
    const { saved } = await savedBuild();
    // Four anchor venues, and a Qloo that ignores venues: nothing is ever lifted.
    const venues = [201, 202, 203, 204].map((n) => ({
      entityId: syntheticId(n),
      name: `Synthetic Room ${n}`,
    }));
    // A 1.0 build's refill, one call a venue (a 2.0 build's reads each venue beside its matched
    // control inside the same 3 calls: tests/unit/ws13/refill-bar.test.ts).
    const flat = {
      ...saved,
      context: {
        ...saved.context,
        anchors: { mid: venues, opener: venues },
        controls: undefined,
      },
    };
    const ignoreVenue = (url: URL) => {
      const signal = url.searchParams.get("signal.interests.entities");
      if (signal)
        url.searchParams.set(
          "signal.interests.entities",
          signal.split(",").slice(0, 2).join(","),
        );
      return syntheticQloo(url);
    };
    const gone = saved.lineup.acts.find((act) => act.band === "mid")!;
    const { run, requests } = refillWith(flat, ignoreVenue);
    const events = await run({
      buildId: saved.id,
      unavailableId: gone.entityId,
      band: "mid",
      anchorVenueId: null,
      excludeIds: [gone.entityId],
    });

    expect(ONE_POINT_OH_REFILL_CAP).toBe(3);
    expect(requests).toHaveLength(3);
    expect(callsOf(events)).toHaveLength(3);
    expect(refillOf(events)).toBeUndefined();
    expect(events.find((event) => event.type === "error")).toMatchObject({
      message:
        "No other Mid act that a Boise venue lifts is left for this slot.",
    });
  });

  it("explains an expired build instead of calling Qloo", async () => {
    const { saved } = await savedBuild();
    const { run, requests } = refillWith(saved);
    const events = await run({
      buildId: "missing",
      unavailableId: "x",
      band: "mid",
      anchorVenueId: null,
      excludeIds: [],
    });
    expect(requests).toHaveLength(0);
    expect(events[0]).toEqual({
      type: "error",
      message: "This build is no longer saved. Build the undercard again.",
    });
  });

  it("rejects a malformed request", async () => {
    const { saved } = await savedBuild();
    const { run, requests } = refillWith(saved);
    const events = await run({ buildId: saved.id, band: "headliner" });
    expect(requests).toHaveLength(0);
    expect(events[0]).toMatchObject({ type: "error" });
  });
});
