import { describe, expect, it } from "vitest";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { controlTownFor, meanOf, tallyBars } from "@/lib/premise-controls";

// Anchor venues per checked town on its saved lineup (counts only, as section 26's table has
// them for the festivals' towns), the numbers section 34's mapping was worked out from.
const ANCHORS: Record<string, number> = {
  Aarhus: 2,
  Asheville: 2,
  Austin: 1,
  Berlin: 2,
  Boise: 2,
  Bozeman: 1,
  Bucharest: 2,
  Burlington: 1,
  Calgary: 2,
  Chicago: 2,
  "Cluj-Napoca": 1,
  Denver: 2,
  Duluth: 1,
  Hamburg: 2,
  "Kansas City": 2,
  Minneapolis: 2,
  Montreal: 2,
  Nashville: 1,
  Oslo: 2,
  Paris: 2,
  Raleigh: 2,
  Reykjavík: 2,
  Rotterdam: 2,
  Seattle: 2,
  Tallinn: 2,
  Toronto: 1,
  Utrecht: 2,
  Vienna: 2,
  Wrexham: 1,
};
const anchorsOf = (city: string) => ANCHORS[city] ?? 0;
const control = (city: string) =>
  controlTownFor(CHECKED_TOWNS, anchorsOf, city, anchorsOf(city))?.city;

describe("controlTownFor", () => {
  it("gives every scored festival's town the control town section 34 lists", () => {
    expect(
      Object.fromEntries(
        [
          "Aarhus",
          "Austin",
          "Berlin",
          "Boise",
          "Bucharest",
          "Calgary",
          "Hamburg",
          "Montreal",
          "Nashville",
          "Oslo",
          "Paris",
          "Raleigh",
          "Reykjavík",
          "Rotterdam",
          "Seattle",
          "Tallinn",
          "Toronto",
          "Utrecht",
          "Wrexham",
        ].map((city) => [city, control(city)]),
      ),
    ).toEqual({
      Aarhus: "Asheville",
      Austin: "Berlin",
      Berlin: "Boise",
      Boise: "Bucharest",
      Bucharest: "Calgary",
      Calgary: "Chicago",
      Hamburg: "Kansas City",
      Montreal: "Oslo",
      Nashville: "Oslo",
      Oslo: "Paris",
      Paris: "Raleigh",
      Raleigh: "Reykjavík",
      Reykjavík: "Rotterdam",
      Rotterdam: "Seattle",
      Seattle: "Tallinn",
      Tallinn: "Utrecht",
      Toronto: "Utrecht",
      Utrecht: "Vienna",
      Wrexham: "Aarhus",
    });
  });

  it("skips a town in the same country and one with too few anchor venues, wrapping round", () => {
    const towns = [
      { city: "Alpha", country: "X" },
      { city: "Bravo", country: "Y" },
      { city: "Charlie", country: "X" },
      { city: "Delta", country: "Y" },
    ];
    const counts: Record<string, number> = {
      Alpha: 2,
      Bravo: 1,
      Charlie: 2,
      Delta: 2,
    };
    const count = (city: string) => counts[city] ?? 0;
    expect(controlTownFor(towns, count, "Alpha", 2)?.city).toBe("Delta");
    expect(controlTownFor(towns, count, "Alpha", 1)?.city).toBe("Bravo");
    expect(controlTownFor(towns, count, "Delta", 2)?.city).toBe("Alpha");
    expect(controlTownFor(towns, count, "Alpha", 3)).toBeNull();
  });
});

describe("meanOf", () => {
  it("averages the lifts there are, and is null with none", () => {
    expect(meanOf([0.1, null, 0.3])).toBeCloseTo(0.2);
    expect(meanOf([null, null])).toBeNull();
    expect(meanOf([])).toBeNull();
  });
});

describe("tallyBars", () => {
  it("counts each side only where it is strictly larger and both are scored", () => {
    const tally = tallyBars([
      { own: 0.03, other: 0.01, signal: 0.05 },
      { own: 0.02, other: 0.02, signal: 0.02 },
      { own: 0.01, other: null, signal: -0.01 },
      { own: -0.01, other: 0.0, signal: null },
    ]);
    expect(tally).toEqual({
      ownBeatsOther: 1,
      venuesBeatSignal: 1,
      signalBeatsVenues: 1,
      scoredA: 3,
      scoredB: 3,
    });
  });
});
