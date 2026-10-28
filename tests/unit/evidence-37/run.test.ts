import { describe, expect, it } from "vitest";
import {
  ALL_ACTS,
  BAR_ACTS,
  controlFestivalFor,
  productBar,
  runFestival,
  summarise,
  type FestivalResult,
} from "@/server/control-test-37";
import { FESTIVALS, TOWNS, memoAsk } from "./world";

async function runAll(ask: ReturnType<typeof memoAsk>["ask"]) {
  const results: FestivalResult[] = [];
  for (const own of FESTIVALS)
    results.push(
      await runFestival(ask, own, controlFestivalFor(FESTIVALS, TOWNS, own)),
    );
  return results;
}

const actsOf = (results: FestivalResult[]) =>
  Object.fromEntries(
    results.flatMap((result) =>
      result.acts.map((act) => [
        act.entityId,
        {
          headlinersOnly: act.headlinersOnlyPlace,
          venue: act.venuePlace,
          control: act.controlPlace,
          localLift: act.localLift,
          climb: act.climbToday,
        },
      ]),
    ),
  );

describe("section 37's run, on a synthetic world", () => {
  it("reads each festival's control town by section 34's rule", () => {
    expect(
      FESTIVALS.map(
        (own) => controlFestivalFor(FESTIVALS, TOWNS, own).town.city,
      ),
    ).toEqual(["Birch", "Cedar", "Birch"]);
  });

  it("gives each act its place with its venue and with the matched control, both measured the same day, and its local lift", async () => {
    const { ask } = memoAsk();
    expect(actsOf(await runAll(ask))).toEqual({
      // Alder Club's control is Birch Cellar: Birch Bar, closer in popularity, is unscored.
      m20: {
        headlinersOnly: 20,
        venue: 1,
        control: 9,
        localLift: 8,
        climb: 19,
      },
      // Alder Hall's popularity comes from /entities; its control is Birch Loft.
      m30: {
        headlinersOnly: 30,
        venue: 1,
        control: 5,
        localLift: 4,
        climb: 29,
      },
      o15: {
        headlinersOnly: 15,
        venue: 1,
        control: 3,
        localLift: 2,
        climb: 14,
      },
      // Birch Cellar's control is Cedar Yard.
      m40: {
        headlinersOnly: 40,
        venue: 1,
        control: 40,
        localLift: 39,
        climb: 39,
      },
      // On the run's day Cedar Room's ranking no longer lists the act: 51st.
      o25: {
        headlinersOnly: 25,
        venue: 51,
        control: 25,
        localLift: -26,
        climb: -26,
      },
    });
  });

  it("matches each venue read, in each tier, to the closest scored room, skipping an unscored one", async () => {
    const { ask } = memoAsk();
    const runs = (await runAll(ask)).flatMap((result) =>
      result.venueRuns.map((run) => ({
        town: result.city,
        band: run.band,
        venue: run.venue.entityId,
        popularity: run.venue.popularity,
        from: run.venue.popularityFrom,
        control: run.control?.entityId ?? null,
        skipped: run.skipped.map((room) => room.entityId),
      })),
    );
    expect(runs).toEqual([
      {
        town: "Alder",
        band: "mid",
        venue: "v-a2",
        popularity: 0.7,
        from: "find_venues",
        control: "v-b2",
        skipped: ["v-b1"],
      },
      {
        town: "Alder",
        band: "mid",
        venue: "v-a1",
        popularity: 0.5,
        from: "entities",
        control: "v-b4",
        skipped: [],
      },
      {
        town: "Alder",
        band: "opener",
        venue: "v-a2",
        popularity: 0.7,
        from: "find_venues",
        control: "v-b2",
        skipped: ["v-b1"],
      },
      {
        town: "Birch",
        band: "mid",
        venue: "v-b2",
        popularity: 0.72,
        from: "find_venues",
        control: "v-c2",
        skipped: [],
      },
      {
        town: "Cedar",
        band: "opener",
        venue: "v-c1",
        popularity: 0.6,
        from: "find_venues",
        control: "v-b4",
        skipped: [],
      },
    ]);
  });

  it("asks each distinct call once: a control that is another festival's venue, the shared headliners-only rankings and the find_venues are read once", async () => {
    const { ask, calls } = memoAsk();
    await runAll(ask);
    const kinds = calls.map((call) =>
      call.path === "/entities"
        ? "entities"
        : call.params["filter.type"] === "urn:entity:place"
          ? `places ${call.params["filter.location.query"]}`
          : `${call.params["filter.popularity.min"] === "0.8" ? "mid" : "opener"} ${call.params["signal.interests.entities"].split(",")[2] ?? "headliners"}`,
    );
    expect(kinds).toEqual([
      // Alder: its control town's rooms, its own, Alder Hall's popularity, both tiers' rankings
      // for the headliners alone, then each venue read and its control.
      "places Birch",
      "places Alder",
      "entities",
      "mid headliners",
      "opener headliners",
      "mid v-a2",
      "mid v-b1",
      "mid v-b2",
      "mid v-a1",
      "mid v-b4",
      "opener v-a2",
      "opener v-b1",
      "opener v-b2",
      // Birch: its own rooms and Birch Cellar's mid ranking were already read for Alder.
      "places Cedar",
      "mid v-c2",
      // Cedar: everything but its venue and its control was already read.
      "opener v-c1",
      "opener v-b4",
    ]);
  });

  it("sends the agent's own parameters with every ranking", async () => {
    const { ask, calls } = memoAsk();
    await runAll(ask);
    const ranked = calls.filter(
      (call) => call.params["filter.type"] === "urn:entity:artist",
    );
    expect(ranked.length).toBeGreaterThan(0);
    for (const { params } of ranked) {
      expect(params["filter.exclude.entities"]).toBe("h-1,h-2");
      expect(params["signal.interests.entities"].startsWith("h-1,h-2")).toBe(
        true,
      );
      expect(params["signal.demographics.age"]).toBe("25_to_29,30_to_34");
      expect(params.take).toBe("50");
      expect([
        ["0.8", "0.92"],
        ["0.55", "0.8"],
      ]).toContainEqual([
        params["filter.popularity.min"],
        params["filter.popularity.max"],
      ]);
    }
  });

  it("gives an act no local lift when no room in the control town has fan data", async () => {
    const { ask } = memoAsk(["v-b1", "v-b2", "v-b3", "v-b4"]);
    const results = await runAll(ask);
    const alder = results[0];
    expect(alder.venueRuns.map((run) => run.control)).toEqual([
      null,
      null,
      null,
    ]);
    expect(alder.acts.map((act) => [act.localLift, act.noLiftBecause])).toEqual(
      [
        [null, "no scored control"],
        [null, "no scored control"],
        [null, "no scored control"],
      ],
    );
    const summary = summarise(results, { towns: TOWNS.length });
    expect(summary.noScoredControl).toBe(4);
    // Alder's three venue runs and Cedar's one tried all four of Birch's rooms with a popularity.
    expect(summary.controlsSkipped).toBe(16);
    expect(summary.roomsSkipped).toBe(4);
  });

  it("counts the acts at a local lift of 5 and of 3, by town and by tier, the skips and the same day's climbs", async () => {
    const { ask } = memoAsk();
    const summary = summarise(await runAll(ask), { towns: TOWNS.length });
    expect(summary).toMatchObject({
      complete: true,
      towns: 3,
      acts: 5,
      atBar: 2,
      atFallback: 3,
      noScoredControl: 0,
      noVenuePopularity: 0,
      controlsSkipped: 2,
      roomsSkipped: 1,
      stillClimb: 4,
      venueRuns: 5,
      popularityFromEntities: 1,
      venuesUnscoredToday: 0,
      // Cedar Yard's mid ranking and Birch Loft's opener ranking are the headliners' own,
      // with no warning: a description, not a skip.
      controlsLikeHeadliners: 2,
    });
    expect(summary.byTown).toEqual([
      {
        city: "Alder",
        controlCity: "Birch",
        acts: 3,
        atBar: 1,
        atFallback: 2,
        stillClimb: 3,
        noScoredControl: 0,
      },
      {
        city: "Birch",
        controlCity: "Cedar",
        acts: 1,
        atBar: 1,
        atFallback: 1,
        stillClimb: 1,
        noScoredControl: 0,
      },
      {
        city: "Cedar",
        controlCity: "Birch",
        acts: 1,
        atBar: 0,
        atFallback: 0,
        stillClimb: 0,
        noScoredControl: 0,
      },
    ]);
    expect(summary.byTier).toEqual({
      mid: { acts: 3, atBar: 2, atFallback: 3 },
      opener: { acts: 2, atBar: 0, atFallback: 0 },
    });
  });

  it("leaves the bar unset until every town is measured", async () => {
    const { ask } = memoAsk();
    const results = await runAll(ask);
    const partial = summarise(results.slice(0, 2), { towns: 3 });
    expect(partial.complete).toBe(false);
    expect(partial.barMet).toBeNull();
    expect(partial.productBar).toBeNull();
  });

  it("sets the product's bar by section 37's rule: 5 places with 145 or more of the 290 at 5, otherwise 3", () => {
    expect([ALL_ACTS, BAR_ACTS]).toEqual([290, 145]);
    expect(productBar(145)).toBe(5);
    expect(productBar(290)).toBe(5);
    expect(productBar(144)).toBe(3);
    expect(productBar(0)).toBe(3);
  });
});
