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
      // Neither of Cedar's rooms moves the mid range's ranking: no control, no local lift.
      m40: {
        headlinersOnly: 40,
        venue: 1,
        control: null,
        localLift: null,
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

  it("matches each venue read, in each tier, to the closest room with fan data, skipping one Qloo warns about or whose ranking is the headliners' own", async () => {
    const { ask } = memoAsk();
    const runs = (await runAll(ask)).flatMap((result) =>
      result.venueRuns.map((run) => ({
        town: result.city,
        band: run.band,
        venue: run.venue.entityId,
        popularity: run.venue.popularity,
        from: run.venue.popularityFrom,
        control: run.control?.entityId ?? null,
        skipped: run.skipped.map(
          (room) => `${room.entityId} (${room.because})`,
        ),
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
        skipped: ["v-b1 (warning)"],
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
        skipped: ["v-b1 (warning)"],
      },
      {
        town: "Birch",
        band: "mid",
        venue: "v-b2",
        popularity: 0.72,
        from: "find_venues",
        control: null,
        skipped: ["v-c2 (equal ranking)", "v-c1 (equal ranking)"],
      },
      {
        town: "Cedar",
        band: "opener",
        venue: "v-c1",
        popularity: 0.6,
        from: "find_venues",
        control: "v-b2",
        skipped: ["v-b4 (equal ranking)", "v-b1 (warning)"],
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
      "mid v-c1",
      // Cedar: Birch Bar's and Birch Cellar's opening rankings were already read for Alder.
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
    // Alder's three acts and Cedar's have no room with fan data in Birch; Birch's act none in
    // Cedar, whose rooms leave the ranking as it was.
    expect(summary.noScoredControl).toBe(5);
    // Birch Cellar, Birch's own venue, is unscored too: its ranking is the headliners' own,
    // and its answer says so. Both are counted, so a run can tell whether warnings come back.
    expect(results[1].venueRuns[0].venueNoFanData).toBe("warning");
    expect(summary.townVenuesWithoutFanData).toEqual({
      warning: 1,
      equalRanking: 0,
    });
    // Alder's three venue runs and Cedar's one tried all four of Birch's rooms with a popularity,
    // each with a warning; Birch's tried both of Cedar's, each with an equal ranking.
    expect(summary).toMatchObject({
      controlsSkipped: 18,
      controlsSkippedByWarning: 16,
      controlsSkippedByEqualRanking: 2,
      roomsSkipped: 6,
      venueRunsWithoutControl: 5,
      controlTownsWithoutFanData: 2,
    });
  });

  it("counts the acts at a local lift of 5 and of 3, by town and by tier, the skips and the same day's climbs", async () => {
    const { ask } = memoAsk();
    const summary = summarise(await runAll(ask), { towns: TOWNS.length });
    expect(summary).toMatchObject({
      complete: true,
      towns: 3,
      acts: 5,
      atBar: 1,
      atFallback: 2,
      noScoredControl: 1,
      // Birch Bar warned twice for Alder and once for Cedar; Cedar Yard's and Cedar Room's mid
      // rankings and Birch Loft's opening ranking are the headliners' own.
      controlsSkipped: 6,
      controlsSkippedByWarning: 3,
      controlsSkippedByEqualRanking: 3,
      roomsSkipped: 4,
      venueRunsWithoutControl: 1,
      controlTownsWithoutFanData: 1,
      stillClimb: 4,
      venueRuns: 5,
      // Distinct venues: Alder Club, Birch Cellar and Cedar Room from their own towns'
      // find_venues, Alder Hall from /entities.
      popularitySources: { find_venues: 3, entities: 1, none: 0 },
      townVenuesWithoutFanData: { warning: 0, equalRanking: 0 },
      actsWithTownVenueWithoutFanData: 0,
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
        atBar: 0,
        atFallback: 0,
        stillClimb: 1,
        noScoredControl: 1,
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
      mid: { acts: 3, atBar: 1, atFallback: 2 },
      opener: { acts: 2, atBar: 0, atFallback: 0 },
    });
  });

  it("with no popularity for a venue from either source, tries the control town's rooms in Qloo's own order", async () => {
    const { ask, calls } = memoAsk(undefined, { entities: false });
    const results = await runAll(ask);
    const hall = results[0].venueRuns[1];
    expect({
      venue: hall.venue.entityId,
      popularity: hall.venue.popularity,
      from: hall.venue.popularityFrom,
      control: hall.control?.entityId,
      skipped: hall.skipped.map((room) => room.entityId),
    }).toEqual({
      venue: "v-a1",
      popularity: null,
      from: null,
      // Birch's answer lists Birch Bar first (warned, skipped), then Birch Cellar.
      control: "v-b2",
      skipped: ["v-b1"],
    });
    // Alder Hall's act: 1st with it, 31st with Birch Cellar.
    expect(results[0].acts[1]).toMatchObject({ localLift: 30 });
    expect(summarise(results, { towns: 3 }).popularitySources).toEqual({
      find_venues: 3,
      entities: 0,
      none: 1,
    });
    // No call beyond the one /entities lookup that came back without a popularity.
    expect(calls.filter((call) => call.path === "/entities")).toHaveLength(1);
  });

  it("keeps the same-day climb of a town venue with no fan data that day, and counts its acts against the bar", async () => {
    // Alder Club's rankings come back as the headliners' own, with no warning.
    const { ask } = memoAsk(undefined, { quiet: ["v-a2"] });
    const results = await runAll(ask);
    expect(
      results[0].venueRuns.map((run) => [
        run.venue.entityId,
        run.venueNoFanData,
      ]),
    ).toEqual([
      ["v-a2", "equal ranking"],
      ["v-a1", null],
      ["v-a2", "equal ranking"],
    ]);
    // Its acts stand where the headliners alone put them: no climb that day.
    expect(
      results[0].acts
        .filter((act) => act.venue.entityId === "v-a2")
        .map((act) => [act.entityId, act.climbToday, act.venueNoFanData]),
    ).toEqual([
      ["m20", 0, "equal ranking"],
      ["o15", 0, "equal ranking"],
    ]);
    const summary = summarise(results, { towns: 3 });
    expect(summary).toMatchObject({
      townVenuesWithoutFanData: { warning: 0, equalRanking: 2 },
      actsWithTownVenueWithoutFanData: 2,
      atBar: 0,
      atFallback: 1,
    });
  });

  it("counts such an act against the bar even when the arithmetic alone would reach it", () => {
    const act = {
      entityId: "x",
      name: "X",
      band: "mid" as const,
      venue: { entityId: "v", name: "V" },
      headlinersOnlyPlace: 20,
      venuePlace: 20,
      controlPlace: 30,
      localLift: 10,
      climbToday: 0,
      noLiftBecause: null,
    };
    const result = {
      festivalId: "f",
      city: "Alder",
      controlCity: "Birch",
      buildId: "b",
      builtAt: "2026-10-17T20:00:00.000Z",
      venueRuns: [],
      acts: [
        { ...act, venueNoFanData: "equal ranking" as const },
        { ...act, entityId: "y", venueNoFanData: null },
      ],
    };
    expect(summarise([result], { towns: 1 })).toMatchObject({
      atBar: 1,
      atFallback: 1,
      actsWithTownVenueWithoutFanData: 1,
      actsWithTownVenueWithoutFanDataAtLift5: 1,
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
