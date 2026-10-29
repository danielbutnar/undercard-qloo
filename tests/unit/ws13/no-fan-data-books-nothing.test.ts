// Daniel, 28 October (19:20), for the 2.0 deploy: "The latent no-fan-data bug: fix it before the
// deploy, not tonight, with a test." A venue Qloo flags as having no fan data (its not-scored
// warning, or a ranking equal to the headliners' own) must never enter the assembly, in any
// tier, in a build, a refill or a redraft. Until now such a venue went in without a control, so
// the 1.0 rule read it, and it booked nothing only because Qloo ranks it like the baseline. Here
// Qloo warns that Larkspur Music Hall wasn't scored, yet its mid-size ranking lists one act the
// baseline doesn't: the old code booked that act from it. Invented data only.
import { describe, expect, it } from "vitest";
import { assembleLineup } from "@/lib/assemble-lineup";
import type { Lineup } from "@/lib/lineup";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleRedraft } from "@/server/redraft";
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
  HALL,
  LANTERN,
  LARKSPUR_FESTIVAL,
  OPENING,
  read,
  runAgent,
  scriptedModel,
  type Turn,
} from "./agent-kit";

const HALL_ONLY = syntheticId(9901);

/** Qloo's answers, but the Hall's warned mid-size ranking opens with an act no one else lists. */
function warnedButDifferent(url: URL): unknown {
  const body = syntheticQloo(url) as {
    warnings?: unknown[];
    results?: { entities: unknown[] };
  };
  const signal = url.searchParams.get("signal.interests.entities") ?? "";
  const hallMid =
    signal.endsWith(HALL) &&
    url.searchParams.get("filter.type") === "urn:entity:artist" &&
    url.searchParams.get("filter.popularity.min") === "0.8";
  if (!hallMid || !body.results) return body;
  expect(body.warnings).toBeTruthy();
  return {
    ...body,
    results: {
      entities: [
        insightsEntity(
          9901,
          "Hall Only",
          0.85,
          0.99,
          HEADLINER_TAGS.slice(0, 2),
        ),
        ...body.results.entities,
      ],
    },
  };
}

const PLAN: Turn[] = [
  ...OPENING,
  [read("mid", HALL), read("opener", HALL)],
  [read("mid", LANTERN), read("opener", LANTERN)],
  [read("mid", FORT), read("opener", FORT)],
  [
    {
      name: "finish",
      input: {
        anchor_venue_ids: [LANTERN, FORT],
        summary: "Two venues with fan data filled both tiers.",
        stopped_because: "every_band_full",
      },
    },
  ],
];

const fromHall = (lineup: Pick<Lineup, "acts"> | null | undefined) =>
  (lineup?.acts ?? []).filter(
    (act) => act.anchorVenue.entityId === HALL || act.entityId === HALL_ONLY,
  );

/** A saved 2.0 build of the plan, its store, and clients for a refill or a redraft. */
async function saved2() {
  const cache = createMemoryCache();
  const store = createBuildStore(cache);
  const qloo = createQlooClient({
    apiKey: "k",
    cache,
    fetch: fakeFetch(warnedButDifferent).fetch,
    sleep: async () => {},
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
  const build = (await store.latest(LARKSPUR_FESTIVAL.id))!;
  const cached = createQlooClient({
    apiKey: "k",
    cache,
    cacheOnly: true,
    fetch: () => {
      throw new Error("the held rankings come from the cache only");
    },
  });
  return { build, store, qloo, cached };
}

describe("a venue Qloo has no fan data for never enters the assembly (Daniel, 19:20)", () => {
  it("books nothing in a build, even when its ranking differs from the headliners' own", async () => {
    const { result, calls } = await runAgent(
      scriptedModel(PLAN).model,
      LARKSPUR_FESTIVAL,
      warnedButDifferent,
    );
    // The Hall's reads came back with Qloo's warning, and its ranking isn't the baseline's.
    expect(
      calls.filter((call) => call.noFanData === "Larkspur Music Hall"),
    ).toHaveLength(2);
    expect(result.lineup?.acts).toHaveLength(10);
    expect(fromHall(result.lineup)).toEqual([]);
  });

  it("fills no tier in the counts the planner reads", async () => {
    const { result } = await runAgent(
      scriptedModel([...OPENING, [read("mid", HALL), read("opener", HALL)]])
        .model,
      LARKSPUR_FESTIVAL,
      warnedButDifferent,
    );
    expect(result.lineup).toBeNull();
  });

  it("books nothing from the rankings a saved 2.0 build holds: its venue switch, refill and redraft read them", async () => {
    const { build, cached } = await saved2();
    expect(build.engine).toBe(2);
    const input = (await assemblyFromSaved(build, LARKSPUR_FESTIVAL, cached))!;
    // Every venue the build read is still in the input, as its context lists them.
    expect(input.venueRuns.some((run) => run.venue.entityId === HALL)).toBe(
      true,
    );
    const everyAct = assembleLineup({
      ...input,
      bands: input.bands.map((band) => ({ ...band, slots: 50 })),
    });
    expect(everyAct.acts.length).toBeGreaterThan(10);
    expect(fromHall(everyAct)).toEqual([]);
  });

  it("is never a refill's or a redraft's pick", async () => {
    const { build, store, qloo, cached } = await saved2();
    // Hall Only, wherever the build put it, is left out of what's excluded, so a rule that let
    // the Hall in would pick it again.
    const gone = build.lineup.acts.find(
      (act) => act.band === "mid" && act.entityId !== HALL_ONLY,
    )!;
    const taken = build.lineup.acts
      .map((act) => act.entityId)
      .filter((id) => id !== HALL_ONLY);
    const refill = await readEvents(
      handleRefill({
        festival: LARKSPUR_FESTIVAL,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => qloo,
        cachedQloo: () => cached,
        store,
        body: {
          buildId: build.id,
          unavailableId: gone.entityId,
          band: "mid",
          anchorVenueId: HALL,
          excludeIds: taken,
        },
      }),
    );
    const refilled = refill.find((event) => event.type === "refill");
    expect(refilled?.type).toBe("refill");
    if (refilled?.type === "refill")
      expect(fromHall({ acts: [refilled.act] })).toEqual([]);
    const redraft = await readEvents(
      handleRedraft({
        festival: LARKSPUR_FESTIVAL,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => qloo,
        cachedQloo: () => cached,
        store,
        body: {
          buildId: build.id,
          replace: build.lineup.acts
            .filter((act) => act.band === "mid" && act.entityId !== HALL_ONLY)
            .map((act) => ({ entityId: act.entityId, band: act.band })),
          excludeIds: taken,
        },
      }),
    );
    const redrafted = redraft.find((event) => event.type === "redraft");
    expect(redrafted?.type).toBe("redraft");
    if (redrafted?.type === "redraft")
      expect(
        fromHall({ acts: redrafted.pairs.map((pair) => pair.act) }),
      ).toEqual([]);
  });
});
