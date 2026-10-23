// WS4, the buyer's shortlist, step 3: the rows, sorted by climb. Each found act carries the venue
// whose fans lift it most and by how many places, its Qloo popularity against the two fee ranges
// (pickTests' range) and the genres it shares with the headliners (the rule's own weights). A
// name Qloo doesn't find, or a headliner, sorts after the ranked acts. Invented names and ids.
import { describe, expect, it } from "vitest";
import {
  ShortlistSchema,
  sortShortlist,
  type ShortlistAct,
} from "@/lib/shortlist";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { callBudget, checkShortlist } from "@/server/shortlist";
import {
  COTTONWOOD,
  FORT,
  id,
  LANTERN,
  qlooWorld,
  savedBuild,
  shortlistQloo,
} from "./world";

const NAMES = [
  "Velvet Coyote",
  "The Long Drives",
  "Marigold Static",
  "Paper Canyon",
  "Nobody Knows Us",
  "Dusk Arcade",
  "Honey Basin",
  "Khruangbin",
  "Lowland Choir",
  "Silver Mesa",
];

async function checked(names = NAMES) {
  const world = qlooWorld(shortlistQloo());
  const shortlist = await checkShortlist({
    festival: SAGEBRUSH_SOUND,
    build: savedBuild(),
    names,
    budget: callBudget({ ...world, cap: 14 }),
  });
  return { shortlist, world };
}

describe("the shortlist's rows (WS4, step 3)", () => {
  it("sorts the acts by climb, then the headliner and the name Qloo didn't find", async () => {
    const { shortlist } = await checked();

    expect(ShortlistSchema.parse(shortlist)).toEqual(shortlist);
    expect(
      shortlist.acts.map((act) =>
        act.status === "found"
          ? [act.qlooName, act.climb, act.best?.venueId ?? null]
          : [act.name, act.status],
      ),
    ).toEqual([
      ["Marigold Static", 5, LANTERN.entityId],
      // Same climb: the better place with the venue's fans first (1st, then 3rd).
      ["Lowland Choir", 5, LANTERN.entityId],
      ["Dusk Arcade", 3, FORT.entityId],
      ["Paper Canyon", 1, FORT.entityId],
      ["Silver Mesa", 1, FORT.entityId],
      ["Velvet Coyote", -1, LANTERN.entityId],
      ["Honey Basin", -1, FORT.entityId],
      ["Long Drives", -2, LANTERN.entityId],
      ["Khruangbin", "headliner"],
      ["Nobody Knows Us", "not-found"],
    ]);
  });

  it("gives each act its popularity against the two fee ranges and the genres it shares with the headliners", async () => {
    const { shortlist } = await checked();
    const fit = (name: string) => {
      const act = shortlist.acts.find(
        (entry): entry is Extract<ShortlistAct, { status: "found" }> =>
          entry.status === "found" && entry.qlooName === name,
      );
      return act && [act.popularity, act.range, act.band, act.genres];
    };

    // Inside the mid-size range (0.80-0.92), inside the opening range (0.55-0.80), above, below.
    expect(fit("Marigold Static")).toEqual([
      0.862,
      "in",
      "mid",
      ["Dream Pop", "Indie Pop"],
    ]);
    expect(fit("Lowland Choir")).toEqual([0.64, "in", "opener", ["Indie Pop"]]);
    expect(fit("Velvet Coyote")).toEqual([
      0.963,
      "above",
      null,
      ["Psychedelic Rock", "Indie Pop"],
    ]);
    expect(fit("Silver Mesa")).toEqual([
      0.47,
      "below",
      null,
      ["Psychedelic Rock"],
    ]);
    // Strongest first, by the rule's weights: each headliner's genre, then the compared tag.
    expect(fit("Dusk Arcade")).toEqual([
      0.912,
      "in",
      "mid",
      ["Dream Pop", "Indie Pop"],
    ]);
    expect(fit("Paper Canyon")).toEqual([0.975, "above", null, []]);
  });

  it("names each venue read, its colour from the town's lineup, the acts it lifts and the one Qloo had no fan data for", async () => {
    const { shortlist } = await checked();

    expect(shortlist.city).toBe("Boise");
    expect(shortlist.headliners).toEqual(["Khruangbin", "Japanese Breakfast"]);
    expect(shortlist.ranked).toBe(true);
    expect(shortlist.venues).toEqual([
      { ...LANTERN, hue: 0, read: true, noFanData: false, lifts: 2 },
      { ...FORT, hue: 1, read: true, noFanData: false, lifts: 3 },
      { ...COTTONWOOD, hue: null, read: true, noFanData: true, lifts: 0 },
    ]);
  });

  it("lists every call in order, named as the trace names them, entity ids shown as names", async () => {
    const { shortlist } = await checked();
    const { calls } = shortlist;

    expect(calls.map((call) => call.n)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1),
    );
    expect(calls.slice(0, 10).map((call) => call.summary)).toEqual(
      NAMES.map((name) => `Search for "${name}"`),
    );
    expect(calls.slice(10).map((call) => call.summary)).toEqual([
      "Your 8 acts ranked for the headliners' fans alone",
      `Your 8 acts ranked with ${LANTERN.name}'s fans added`,
      `Your 8 acts ranked with ${FORT.name}'s fans added`,
      `Your 8 acts ranked with ${COTTONWOOD.name}'s fans added`,
    ]);
    expect(calls[11].params).toEqual([
      { key: "filter.type", value: "urn:entity:artist" },
      {
        key: "signal.interests.entities",
        value: `Khruangbin, Japanese Breakfast, ${LANTERN.name}`,
      },
      {
        key: "filter.results.entities",
        value:
          "Velvet Coyote, Long Drives, Marigold Static, Paper Canyon, Dusk Arcade, Honey Basin, Lowland Choir, Silver Mesa",
      },
      { key: "signal.demographics.age", value: "25_to_29, 30_to_34" },
      { key: "take", value: "8" },
    ]);
    expect(calls.every((call) => call.cached === false)).toBe(true);
    expect([shortlist.made, shortlist.cap]).toEqual([14, 14]);
  });

  it("asks nothing more of Qloo when no name is found: no ranking call", async () => {
    const { shortlist, world } = await checked([
      "Nobody Knows Us",
      "Ghost Name",
    ]);

    expect(world.requests).toHaveLength(2);
    expect(shortlist.ranked).toBe(false);
    expect(shortlist.acts.map((act) => act.status)).toEqual([
      "not-found",
      "not-found",
    ]);
  });
});

describe("sorting a shortlist", () => {
  const found = (
    name: string,
    climb: number | null,
    place: number | null,
  ): ShortlistAct => ({
    name,
    status: "found",
    entityId: id(900),
    qlooName: name,
    popularity: 0.85,
    range: "in",
    band: "mid",
    genres: [],
    alone: climb !== null && place !== null ? place + climb : null,
    best: place === null ? null : { venueId: id(201), place },
    climb,
  });

  it("puts acts with a climb first, then acts Qloo couldn't place, then the rest in the buyer's order", () => {
    expect(
      sortShortlist([
        { name: "Not Found", status: "not-found" },
        found("Unplaced", null, null),
        { name: "Unchecked", status: "not-checked" },
        found("Small", 1, 2),
        { name: "Head", status: "headliner", qlooName: "Head" },
        found("Big", 4, 1),
        found("Drop", -1, 3),
      ]).map((act) => act.name),
    ).toEqual([
      "Big",
      "Small",
      "Drop",
      "Unplaced",
      "Head",
      "Unchecked",
      "Not Found",
    ]);
  });
});
