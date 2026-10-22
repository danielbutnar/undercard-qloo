// WS11 (Daniel's brief of 2026-10-22), step 2: the saved builds are read with replay-only
// requests, POST /api/undercard {festival, replayOnly: true}, which make no Qloo or model call
// and write nothing. From each replay come the town's venue counts and slots filled, its calls,
// the climbs on its first screen and the acts it shares with Boise's lineup. Here the route runs
// in the test against the synthetic build (UNDERCARD_E2E_SYNTHETIC=1): invented acts and rooms,
// saved for Boise, Austin, Denver and Nashville only.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";
import {
  describe as describeComputation,
  evaluate,
  loadReplays,
  replayOnly,
  type Computation,
  type EvidenceData,
} from "../../../scripts/evidence-check";
import { POST } from "@/app/api/undercard/route";
import { CHECKED_TOWNS } from "@/lib/checked-towns";

const BASE = "http://synthetic.test";
const bodies: unknown[] = [];
/** The build route itself, answering in the test instead of over the network. */
const routeFetch: typeof fetch = async (input, init) => {
  bodies.push(JSON.parse(String(init?.body)));
  return POST(new Request(input instanceof Request ? input.url : input, init));
};

let data: EvidenceData;
beforeAll(async () => {
  vi.stubEnv("UNDERCARD_E2E_SYNTHETIC", "1");
  data = {
    towns: await loadReplays(BASE, { fetch: routeFetch }),
    without: null,
    run: null,
  };
}, 60_000);
afterAll(() => {
  vi.unstubAllEnvs();
});

const value = (computation: Computation) => evaluate(computation, data);

describe("replay-only requests", () => {
  it("ask for each checked town's saved build as a replay, and nothing else", () => {
    expect(data.towns.map((town) => town.town)).toEqual(CHECKED_TOWNS);
    expect(bodies).toHaveLength(CHECKED_TOWNS.length);
    for (const body of bodies)
      expect(Object.keys(body as object).sort()).toEqual([
        "festival",
        "replayOnly",
      ]);
    expect(bodies[0]).toEqual({
      festival: "sagebrush-sound",
      replayOnly: true,
    });
    expect(bodies[1]).toEqual({
      festival: "sagebrush-sound-austin",
      replayOnly: true,
    });
  });

  it("read a saved build's trace and lineup, and say when a town has none", () => {
    const [boise] = data.towns;
    expect(boise.replay.build).toEqual({
      id: "synthetic-build",
      createdAt: "2026-10-15T14:02:00.000Z",
    });
    expect(boise.replay.trace).toHaveLength(12);
    expect(boise.replay.lineup?.acts).toHaveLength(10);
    const raleigh = data.towns.find((town) => town.town.city === "Raleigh")!;
    expect(raleigh.replay).toMatchObject({
      lineup: null,
      code: "no-saved-build",
    });
  });

  it("stop reading when the answer isn't a replay", async () => {
    let cancelled = false;
    const live: typeof fetch = async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                `${JSON.stringify({ type: "build", id: "x", createdAt: "2026-10-22T00:00:00Z", replayed: false })}\n`,
              ),
            );
          },
          cancel() {
            cancelled = true;
          },
        }),
      );
    const replay = await replayOnly(BASE, "sagebrush-sound", live);
    expect(replay.lineup).toBeNull();
    expect(replay.error).toMatch(/not a replay/);
    expect(cancelled).toBe(true);
  });
});

describe("what each town's replay gives", () => {
  it("counts the acts each tested venue lifted, a zero included", () => {
    expect(
      value({ kind: "venue-acts", town: "Boise", venue: "The Lantern Room" }),
    ).toBe(7);
    expect(
      value({
        kind: "venue-acts",
        town: "Boise",
        venue: "Fort Street Ballroom",
      }),
    ).toBe(3);
    expect(
      value({
        kind: "venue-acts",
        town: "Boise",
        venue: "Cottonwood Social Hall",
      }),
    ).toBe(0);
    expect(value({ kind: "venues-tested", town: "Boise" })).toBe(3);
    expect(
      value({ kind: "venue-acts", town: "Boise", venue: "The Lantern" }),
    ).toEqual({ missing: "Boise's saved build didn't test The Lantern" });
    expect(
      value({ kind: "venue-acts", town: "Raleigh", venue: "The Lantern Room" }),
    ).toEqual({ missing: "Raleigh has no saved build" });
  });

  it("knows a venue by the name the docs give it, without Qloo's bracketed abbreviation", () => {
    // Qloo can file a room as "Name (ABC)"; the docs and the marks (src/lib/marks.ts) drop that.
    const [boise] = data.towns;
    const renamed = (text: string) =>
      text.replace(/The Lantern Room/g, "The Lantern Room (TLR)");
    const lineup = boise.replay.lineup!;
    const bracketed: EvidenceData = {
      ...data,
      towns: [
        {
          ...boise,
          replay: {
            ...boise.replay,
            trace: boise.replay.trace.map((call) => ({
              ...call,
              summary: renamed(call.summary),
            })),
            lineup: {
              ...lineup,
              acts: lineup.acts.map((act) => ({
                ...act,
                anchorVenue: {
                  ...act.anchorVenue,
                  name: renamed(act.anchorVenue.name),
                },
              })),
            },
          },
        },
      ],
    };
    const lifted = (venue: string) =>
      evaluate({ kind: "venue-acts", town: "Boise", venue }, bracketed);
    expect(lifted("The Lantern Room")).toBe(7);
    expect(lifted("The Lantern Room (TLR)")).toBe(7);
    expect(lifted("Cottonwood Social Hall")).toBe(0);
    expect(evaluate({ kind: "venues-tested", town: "Boise" }, bracketed)).toBe(
      3,
    );
  });

  it("counts the calls, the slots filled and the brief's slots", () => {
    expect(value({ kind: "calls", town: "Austin" })).toBe(12);
    expect(value({ kind: "filled", town: "Boise", band: "mid" })).toBe(4);
    expect(value({ kind: "filled", town: "Boise", band: "opener" })).toBe(6);
    expect(value({ kind: "slots", town: "Boise", band: "mid" })).toBe(4);
    expect(value({ kind: "slots", town: "Boise", band: "opener" })).toBe(6);
    expect(
      value({
        kind: "calls-across",
        towns: ["Austin", "Denver", "Nashville"],
        end: "most",
      }),
    ).toBe(12);
    expect(
      value({
        kind: "refused-calls",
        towns: ["Austin", "Denver", "Nashville"],
      }),
    ).toBe(0);
  });

  it("counts the towns whose saved build fills every slot, and the builds made on a day", () => {
    // Only the four demo towns have a synthetic build; a town with none isn't full.
    expect(value({ kind: "full-lineups", towns: "all" })).toBe(4);
    expect(value({ kind: "full-lineups", towns: "later" })).toBe(0);
    expect(value({ kind: "built-on", date: "2026-10-15", towns: "all" })).toBe(
      4,
    );
    expect(
      value({ kind: "calls-across", towns: "later", end: "fewest" }),
    ).toEqual({
      missing: "no saved build for any of them",
    });
  });

  it("reads the climbs on the first screen, biggest first, and the NEW acts", () => {
    expect(value({ kind: "climb", town: "Boise", band: "mid", rank: 1 })).toBe(
      26,
    );
    expect(value({ kind: "climb", town: "Boise", band: "mid", rank: 4 })).toBe(
      7,
    );
    expect(
      value({ kind: "climb", town: "Boise", band: "opener", rank: 1 }),
    ).toBe(30);
    expect(
      value({ kind: "climb", town: "Boise", band: "opener", rank: 6 }),
    ).toEqual({
      missing: "Boise's first screen shows 5 Opener climbs; the rest are NEW",
    });
    expect(value({ kind: "new-acts", town: "Boise" })).toBe(1);
    expect(value({ kind: "baseline-top", town: "Boise" })).toBe(50);
  });

  it("counts the acts a town shares with Boise's lineup and the ones it replaces", () => {
    // The synthetic towns carry Boise's own bill.
    expect(value({ kind: "shared-with-boise", town: "Austin" })).toBe(10);
    expect(value({ kind: "own-vs-boise", town: "Austin" })).toBe(0);
    expect(value({ kind: "own-vs-boise", town: "Raleigh" })).toEqual({
      missing: "Raleigh has no saved build",
    });
  });

  it("checks every act on the Qloo lineups against the three tests", () => {
    for (const count of [
      "acts",
      "inRange",
      "twoGenres",
      "climbs",
      "allThree",
    ] as const)
      expect(value({ kind: "with-qloo", count })).toBe(40);
  });

  it("counts the lists a replay's climb rebuilt from the cache", () => {
    // The synthetic server has no cache-only Qloo client, so its replays carry no climb.
    expect(value({ kind: "climb-rebuilt", of: "towns" })).toBe(0);
    const [boise] = data.towns;
    const withClimb: EvidenceData = {
      ...data,
      towns: [
        {
          ...boise,
          replay: {
            ...boise.replay,
            climbs: boise.replay.trace
              .filter((call) => /_artists$/.test(call.tool))
              .map(() => ({
                type: "climb" as const,
                band: "mid" as const,
                venue: null,
                acts: [],
              })),
          },
        },
      ],
    };
    expect(evaluate({ kind: "climb-rebuilt", of: "towns" }, withClimb)).toBe(1);
    expect(
      evaluate({ kind: "climb-rebuilt", of: "most-lists" }, withClimb),
    ).toBe(7);
  });

  it("reads the rule, the brief's fee range and the checked towns from the code", () => {
    expect(value({ kind: "rule", of: "min-lift" })).toBe(5);
    expect(value({ kind: "rule", of: "call-cap" })).toBe(12);
    expect(value({ kind: "rule", of: "refill-cap" })).toBe(3);
    expect(value({ kind: "fee-range", end: "bottom" })).toBeCloseTo(55, 6);
    expect(value({ kind: "fee-range", end: "top" })).toBeCloseTo(92, 6);
    expect(value({ kind: "checked-towns" })).toBe(29);
  });

  it("says in words where each number comes from", () => {
    expect(
      describeComputation({
        kind: "venue-acts",
        town: "Austin",
        venue: "Venue 213 Austin",
      }),
    ).toBe("Austin's saved build: acts Venue 213 Austin lifted");
    expect(
      describeComputation({ kind: "shared-with-boise", town: "Denver" }),
    ).toBe("Denver's saved lineup: acts also on Boise's");
    expect(describeComputation({ kind: "full-lineups", towns: "all" })).toBe(
      "the 29 towns' saved builds: every slot filled",
    );
  });
});
