// WS4, the buyer's shortlist, step 2: the town's saved build gives the headliners, the anchor
// venues and the crowd's age; one /v2/insights call for the headliners alone and one per anchor
// venue score every act inside the same call (filter.results.entities). Qloo normalises scores
// per query, so places are compared within a call, never raw scores across calls: an act's
// climb is its place for the headliners alone minus its best place with one venue's fans added.
import { describe, expect, it } from "vitest";
import { climbOf, placesIn, sameAnswer } from "@/lib/shortlist";
import type { QlooEntity } from "@/server/qloo";
import { callBudget, rankShortlist, resolveNames } from "@/server/shortlist";
import {
  COTTONWOOD,
  FORT,
  id,
  LANTERN,
  params,
  qlooWorld,
  savedBuild,
  SCORES,
  shortlistQloo,
} from "./world";

const NAMES = [
  "Velvet Coyote",
  "The Long Drives",
  "Marigold Static",
  "Paper Canyon",
  "Dusk Arcade",
  "Honey Basin",
  "Lowland Choir",
  "Silver Mesa",
];

async function ranked(names = NAMES, scores = SCORES) {
  const world = qlooWorld(shortlistQloo(scores));
  const budget = callBudget({ ...world, cap: 14 });
  const build = savedBuild();
  const { acts } = await resolveNames({
    names,
    budget,
    headlinerIds: new Set([id(1), id(2)]),
  });
  const artists = acts.flatMap((act) =>
    act.status === "found" ? [act.artist] : [],
  );
  const before = world.requests.length;
  const result = await rankShortlist({ build, artists, budget });
  return { result, artists, insights: world.requests.slice(before), budget };
}

describe("the shortlist's Qloo calls (WS4, step 2)", () => {
  it("asks once for the headliners alone and once per anchor venue, every act scored in each call", async () => {
    const { insights, artists, result } = await ranked();

    const among = artists
      .map((artist) => artist.entityId)
      .sort()
      .join(",");
    const signal = (...venue: string[]) => [id(1), id(2), ...venue].join(",");
    // The build's anchors, each venue once: Mid read three, Opener two of the same.
    expect(insights.map(({ url }) => params(url))).toEqual(
      [
        signal(),
        ...[LANTERN, FORT, COTTONWOOD].map((v) => signal(v.entityId)),
      ].map((entities) => ({
        "filter.type": "urn:entity:artist",
        "signal.interests.entities": entities,
        "filter.results.entities": among,
        "signal.demographics.age": "25_to_29,30_to_34",
        take: "8",
      })),
    );
    expect(insights.every(({ url }) => url.pathname === "/v2/insights")).toBe(
      true,
    );
    expect(result.calls.map((call) => call.path)).toEqual(
      Array(4).fill("/v2/insights"),
    );
  });

  it("climbs by places within each call, never by raw scores across calls", async () => {
    const { result } = await ranked();
    const climb = (n: number) => result.climbs.get(id(n));

    // Marigold Static's score falls with The Lantern Room's fans (0.85 to 0.80, a lower-scored
    // answer), yet it rises from 6th to 1st there: a climb of 5.
    expect(climb(303)).toEqual({
      alone: 6,
      best: { venueId: LANTERN.entityId, place: 1 },
      climb: 5,
    });
    expect(climb(307)).toEqual({
      alone: 8,
      best: { venueId: LANTERN.entityId, place: 3 },
      climb: 5,
    });
    // Dusk Arcade's best place is with Fort Street Ballroom's fans: 4th to 1st.
    expect(climb(305)).toEqual({
      alone: 4,
      best: { venueId: FORT.entityId, place: 1 },
      climb: 3,
    });
    // Velvet Coyote leads for the headliners alone and is 2nd with either venue: no venue lifts
    // it, and a tie goes to the venue read first.
    expect(climb(301)).toEqual({
      alone: 1,
      best: { venueId: LANTERN.entityId, place: 2 },
      climb: -1,
    });
  });

  it("names a venue whose answer is the headliners' own as one Qloo had no fan data for, and leaves it out of the climb", async () => {
    const { result } = await ranked();

    expect(result.ranked).toBe(true);
    expect(
      result.venues.map(({ venue, read, noFanData, lifts }) => ({
        name: venue.name,
        read,
        noFanData,
        lifts,
      })),
    ).toEqual([
      { name: LANTERN.name, read: true, noFanData: false, lifts: 2 },
      { name: FORT.name, read: true, noFanData: false, lifts: 3 },
      { name: COTTONWOOD.name, read: true, noFanData: true, lifts: 0 },
    ]);
    // With Cottonwood Social Hall's answer counted, Velvet Coyote would keep 1st: a climb of 0.
    expect(result.climbs.get(id(301))?.best?.venueId).not.toBe(
      COTTONWOOD.entityId,
    );
  });

  it("keeps a venue whose scores change but whose order doesn't: its fans lift none of these acts", async () => {
    // Two acts; Fort Street Ballroom's fans change their scores but not their order.
    const { result } = await ranked(["Velvet Coyote", "Dusk Arcade"], {
      ...SCORES,
      301: { alone: 0.95, lantern: 0.7, fort: 0.9 },
      305: { alone: 0.89, lantern: 0.8, fort: 0.88 },
    });
    const fort = result.venues.find(({ venue }) => venue.name === FORT.name);

    expect(fort).toMatchObject({ noFanData: false, lifts: 0 });
    expect(result.climbs.get(id(305))).toEqual({
      alone: 2,
      best: { venueId: LANTERN.entityId, place: 1 },
      climb: 1,
    });
  });
});

describe("the climb's arithmetic", () => {
  const entity = (entityId: string, affinity: number | null) =>
    ({ entityId, affinity }) as Pick<QlooEntity, "entityId" | "affinity">;

  it("places an answer's acts by Qloo's score, highest first; an act without a score has no place", () => {
    const places = placesIn([
      entity("b", 0.4),
      entity("a", 0.9),
      entity("c", null),
      entity("d", 0.6),
    ]);
    expect([...places]).toEqual([
      ["a", 1],
      ["d", 2],
      ["b", 3],
    ]);
  });

  it("tells the same answer, act for act and score for score, from one that differs in either", () => {
    const answer = [entity("a", 0.9), entity("b", 0.8)];
    expect(sameAnswer(answer, [entity("a", 0.9), entity("b", 0.8)])).toBe(true);
    expect(sameAnswer(answer, [entity("a", 0.9), entity("b", 0.79)])).toBe(
      false,
    );
    expect(sameAnswer(answer, [entity("b", 0.8), entity("a", 0.9)])).toBe(
      false,
    );
    expect(sameAnswer(answer, [entity("a", 0.9)])).toBe(false);
  });

  it("is the place alone minus the best place with one venue's fans, the first venue winning a tie", () => {
    const alone = new Map([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    const venues = [
      {
        venueId: "v1",
        places: new Map([
          ["a", 2],
          ["b", 1],
          ["c", 3],
        ]),
      },
      {
        venueId: "v2",
        places: new Map([
          ["a", 3],
          ["c", 1],
          ["b", 2],
        ]),
      },
    ];
    expect(climbOf("b", alone, venues)).toEqual({
      alone: 2,
      best: { venueId: "v1", place: 1 },
      climb: 1,
    });
    expect(climbOf("c", alone, venues)).toEqual({
      alone: 3,
      best: { venueId: "v2", place: 1 },
      climb: 2,
    });
    expect(climbOf("a", alone, venues)).toEqual({
      alone: 1,
      best: { venueId: "v1", place: 2 },
      climb: -1,
    });
  });

  it("has no climb for an act Qloo didn't place for the headliners alone, or with no venue", () => {
    const alone = new Map([["a", 1]]);
    const venues = [
      {
        venueId: "v1",
        places: new Map([
          ["z", 1],
          ["a", 2],
        ]),
      },
    ];
    expect(climbOf("z", alone, venues)).toEqual({
      alone: null,
      best: { venueId: "v1", place: 1 },
      climb: null,
    });
    expect(climbOf("a", alone, [])).toEqual({
      alone: 1,
      best: null,
      climb: null,
    });
  });
});
