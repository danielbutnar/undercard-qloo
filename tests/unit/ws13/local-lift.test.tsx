// @vitest-environment jsdom
// WS13 item 3: a control for every venue. For each venue read, the agent also reads its matched
// control abroad (section 37's rule: the control town is the next checked town in alphabetical
// order in another country, no anchor clause; a judge's own town takes the first checked town in
// another country; the control is that town's room closest in Qloo popularity, ties by name,
// skipping a room Qloo has no fan data for). An act books only if it climbs at least 5 places with
// the town's venue and its local lift (that climb minus its climb with the control) is at least
// the bar, 5 places (section 37's result). Invented data only.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { climbsLine } from "@/lib/agent-words";
import {
  assembleLineup,
  LOCAL_LIFT_BAR,
  MIN_LIFT,
  type AssemblyInput,
  type RankedArtist,
} from "@/lib/assemble-lineup";
import { controlTownFor } from "@/lib/control-town";
import type { Act } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { switchedLineup } from "@/lib/venue-switch";
import { ActCard } from "@/components/act-card";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";
import { readVenueSwitch } from "@/server/venue-switch";
import { fakeFetch, syntheticId, syntheticQloo } from "../m2/fake-qloo";
import { readEvents } from "../m3/scripted";
import {
  FORT,
  HALL,
  LANTERN,
  LARKSPUR_FESTIVAL,
  opened,
  OPENING,
  read,
  resultOf,
  runAgent,
  scriptedModel,
  type Turn,
} from "./agent-kit";

afterEach(cleanup);

describe("the control town (section 37's reading 1)", () => {
  it("is the next checked town in alphabetical order in another country, with no anchor clause", () => {
    const of = (city: string, region: string) =>
      controlTownFor({ city, region })?.city;
    expect(of("Boise", "Idaho")).toBe("Bucharest");
    expect(of("Bucharest", "Romania")).toBe("Burlington");
    expect(of("Montreal", "Quebec")).toBe("Nashville");
    expect(of("Tallinn", "Estonia")).toBe("Toronto");
    expect(of("Wrexham", "Wales")).toBe("Aarhus");
  });

  it("is the first checked town in another country for a judge's own town", () => {
    const of = (city: string, region: string) =>
      controlTownFor({ city, region })?.city;
    expect(of("Larkspur", "Idaho")).toBe("Aarhus");
    expect(of("Odense", "Denmark")).toBe("Asheville");
    expect(of("Portland", "Oregon")).toBe("Aarhus");
  });
});

// Invented acts: a baseline of 20, a venue run and a control run for one tier.
const tags = [
  {
    id: "urn:tag:genre:music:dream_pop",
    name: "Dream Pop",
    type: "urn:tag:genre:music",
  },
  {
    id: "urn:tag:genre:music:indie_rock",
    name: "Indie Rock",
    type: "urn:tag:genre:music",
  },
];
const act = (n: number, affinity = 0.9): RankedArtist => ({
  entityId: `act-${n}`,
  name: `Act ${n}`,
  popularity: 0.85,
  affinity,
  tags,
});
const baseline = Array.from({ length: 20 }, (_, n) => act(n));
const VENUE = { entityId: "venue", name: "Venue 227" };
const CONTROL = { entityId: "control", name: "Strada Hall" };

function oneTier({
  venueOrder,
  controlOrder,
}: {
  venueOrder: number[];
  controlOrder: number[] | null;
}): AssemblyInput {
  return {
    bands: [{ ...SAGEBRUSH_SOUND.feeBands[0], slots: 2 }],
    headliners: [
      { entityId: "h1", name: "One", tags },
      { entityId: "h2", name: "Two", tags },
    ],
    comparedTags: [],
    baselines: { mid: baseline },
    venueRuns: [
      {
        venue: VENUE,
        band: "mid",
        artists: venueOrder.map((n, position) =>
          act(n, 0.95 - position * 0.01),
        ),
        control:
          controlOrder === null
            ? null
            : {
                venue: { ...CONTROL, town: "Bucharest" },
                artists: controlOrder.map((n) => act(n)),
              },
      },
    ],
  };
}

describe("the rule with a control (WS13.3)", () => {
  it("is Daniel's bar of 5 places, beside the climb of 5", () => {
    expect(LOCAL_LIFT_BAR).toBe(5);
    expect(MIN_LIFT).toBe(5);
  });

  it("books an act only if its local lift reaches the bar, and carries both climbs", () => {
    // With the venue, act 15 climbs 15 places (16th to 1st) and act 14 climbs 13 (15th to 2nd).
    // With the control, act 15 climbs 12 (to 4th), act 14 climbs 2 (to 13th).
    const venueOrder = [
      15,
      14,
      ...baseline.map((_, n) => n).filter((n) => n < 14 || n > 15),
    ];
    const controlOrder = [
      0, 1, 2, 15, 3, 4, 5, 6, 7, 8, 9, 10, 14, 11, 12, 13, 16, 17, 18, 19,
    ];
    const { acts } = assembleLineup(oneTier({ venueOrder, controlOrder }));
    expect(acts.map((entry) => entry.entityId)).not.toContain("act-15");
    const fourteen = acts.find((entry) => entry.entityId === "act-14");
    expect(fourteen?.localLift).toEqual({
      venueClimb: 13,
      controlClimb: 2,
      control: { entityId: "control", name: "Strada Hall", town: "Bucharest" },
    });
  });

  it("books nothing from a venue with no scored control", () => {
    const venueOrder = [
      15,
      14,
      ...baseline.map((_, n) => n).filter((n) => n < 14 || n > 15),
    ];
    const { acts, shortfall } = assembleLineup(
      oneTier({ venueOrder, controlOrder: null }),
    );
    expect(acts).toEqual([]);
    expect(shortfall.mid).toBe(2);
  });

  it("counts a place outside the control's ranking as 51st", () => {
    const venueOrder = [
      15,
      ...baseline.map((_, n) => n).filter((n) => n !== 15),
    ];
    const controlOrder = baseline.map((_, n) => n).filter((n) => n !== 15);
    const { acts } = assembleLineup(oneTier({ venueOrder, controlOrder }));
    const fifteen = acts.find((entry) => entry.entityId === "act-15");
    // 16th to 1st with the venue; missing with the control: 51st, a climb of -35.
    expect(fifteen?.localLift).toMatchObject({
      venueClimb: 15,
      controlClimb: -35,
    });
  });

  it("leaves a 1.0 build's runs, which have no control, to the rule as it was", () => {
    const venueOrder = [
      15,
      14,
      ...baseline.map((_, n) => n).filter((n) => n < 14 || n > 15),
    ];
    const input = oneTier({ venueOrder, controlOrder: [] });
    delete (input.venueRuns[0] as { control?: unknown }).control;
    const { acts } = assembleLineup(input);
    expect(acts.map((entry) => entry.entityId)).toEqual(["act-15", "act-14"]);
    expect(acts.every((entry) => entry.localLift === undefined)).toBe(true);
  });
});

describe("the agent reads a matched control for every venue read (WS13.3)", () => {
  it("lists the control town's rooms once, then reads the closest room with fan data, skipping one without", async () => {
    const { toolbox, calls } = await opened();
    const result = resultOf(
      await toolbox.run("venue_artists", { band: "mid", venue_id: LANTERN }),
    );
    const tools = calls().map((call) => call.tool);
    expect(tools.filter((tool) => tool === "control_venues")).toHaveLength(1);
    // Aarhus Club ties with Aarhus Hall and comes first by name; Qloo has no fan data for it.
    const controls = calls().filter((call) => call.tool === "control_artists");
    expect(controls.map((call) => call.noFanData ?? null)).toEqual([
      "Aarhus Club",
      null,
    ]);
    expect(controls[1].summary).toContain("Aarhus Hall");
    expect(controls[1].controlFor).toBe("The Lantern Room");
    expect(result.control).toBe(
      "Aarhus Hall, a room in Aarhus with similar Qloo popularity",
    );
    expect(result.acts_with_local_lift_5_or_more).toBeGreaterThan(0);
  });

  it("never asks Qloo again for a room it knows has no fan data, or for a control ranking it already has", async () => {
    const { toolbox, calls } = await opened();
    await toolbox.run("venue_artists", { band: "mid", venue_id: LANTERN });
    const before = calls().length;
    await toolbox.run("venue_artists", { band: "mid", venue_id: FORT });
    // Fort's read and nothing else: the same matched control's mid ranking is already in.
    expect(
      calls()
        .slice(before)
        .map((call) => call.tool),
    ).toEqual(["venue_artists"]);
  });

  it("reads no control for a venue Qloo has no fan data for", async () => {
    const { toolbox, calls } = await opened();
    await toolbox.run("venue_artists", { band: "mid", venue_id: HALL });
    expect(calls().some((call) => call.tool.startsWith("control"))).toBe(false);
  });

  it("books only acts with both climbs, and every act on the lineup carries them", async () => {
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
    const { result } = await runAgent(scriptedModel(PLAN).model);
    expect(result.complete).toBe(true);
    for (const entry of result.lineup!.acts) {
      expect(entry.localLift).toBeDefined();
      const { venueClimb, controlClimb } = entry.localLift!;
      expect(venueClimb).toBeGreaterThanOrEqual(MIN_LIFT);
      expect(venueClimb - controlClimb).toBeGreaterThanOrEqual(LOCAL_LIFT_BAR);
      expect(entry.localLift!.control.town).toBe("Aarhus");
    }
    expect(result.context.controls?.mid?.[0]).toEqual({
      venueId: LANTERN,
      control: {
        entityId: syntheticId(401),
        name: "Aarhus Hall",
        town: "Aarhus",
      },
    });
  });

  it("tells the planner a tier isn't full when no act clears the bar, so it reads the next venue", async () => {
    // Every control ranks acts as the venue does: no act's local lift reaches the bar.
    const same = (url: URL) => {
      const signal = url.searchParams.get("signal.interests.entities") ?? "";
      const control = signal.endsWith(syntheticId(401));
      if (control)
        url.searchParams.set(
          "signal.interests.entities",
          signal.replace(syntheticId(401), LANTERN),
        );
      return syntheticQloo(url);
    };
    const { toolbox } = await opened(LARKSPUR_FESTIVAL, same);
    const result = resultOf(
      await toolbox.run("venue_artists", { band: "mid", venue_id: LANTERN }),
    );
    expect(result.acts_with_local_lift_5_or_more).toBe(0);
    expect(result.tiers).toMatchObject({ mid: { filled: 0, slots: 4 } });
    expect(result.every_tier_full).toBe(false);
  });

  it("rebuilds a 2.0 build's venue switch with its controls, equal to the saved lineup with every venue on", async () => {
    const cache = createMemoryCache();
    const store = createBuildStore(cache);
    const qloo = createQlooClient({
      apiKey: "k",
      cache,
      fetch: fakeFetch(syntheticQloo).fetch,
    });
    const plan: Turn[] = [
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
    await readEvents(
      handleUndercardBuild({
        festival: LARKSPUR_FESTIVAL,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        store,
        fresh: true,
        qloo: () => qloo,
        model: () => scriptedModel(plan).model,
      }),
    );
    const saved = (await store.latest(LARKSPUR_FESTIVAL.id))!;
    const data = await readVenueSwitch({
      store,
      festival: LARKSPUR_FESTIVAL,
      qloo: createQlooClient({
        apiKey: "k",
        cache,
        cacheOnly: true,
        fetch: () => {
          throw new Error("the switch must not call Qloo");
        },
      }),
      buildId: saved.id,
    });
    expect(data).not.toBeNull();
    const every = new Set(data!.venues.map((venue) => venue.entityId));
    expect(switchedLineup(data!, every).acts).toEqual(saved.lineup.acts);
  });
});

describe("the card's line (WS13.3)", () => {
  const entry: Act = {
    entityId: "act-14",
    name: "Hollow Pines",
    band: "mid",
    affinity: 0.9,
    popularity: 0.85,
    anchorVenue: { entityId: "venue", name: "Venue 227" },
    reason: "Venue 227 fans move it up 15 places.",
    sharedTags: [
      { id: "urn:tag:genre:music:dream_pop", name: "Dream Pop" },
      { id: "urn:tag:genre:music:indie_rock", name: "Indie Rock" },
    ],
    localLift: {
      venueClimb: 15,
      controlClimb: 2,
      control: { entityId: "control", name: "Strada Hall", town: "Bucharest" },
    },
  };

  it("gives both climbs in words", () => {
    expect(climbsLine(entry)).toBe(
      "↑15 with Venue 227's fans · ↑2 with a room in Bucharest with similar Qloo popularity",
    );
    expect(
      climbsLine({
        ...entry,
        localLift: { ...entry.localLift!, controlClimb: -3 },
      }),
    ).toBe(
      "↑15 with Venue 227's fans · ↓3 with a room in Bucharest with similar Qloo popularity",
    );
    expect(
      climbsLine({
        ...entry,
        localLift: { ...entry.localLift!, controlClimb: 0 },
      }),
    ).toBe(
      "↑15 with Venue 227's fans · no climb with a room in Bucharest with similar Qloo popularity",
    );
    expect(climbsLine({ ...entry, localLift: undefined })).toBeNull();
  });

  it("puts it in one line of the card body", () => {
    render(<ActCard act={entry} />);
    expect(
      screen.getByText(
        "↑15 with Venue 227's fans · ↑2 with a room in Bucharest with similar Qloo popularity",
      ),
    ).toBeTruthy();
  });
});
