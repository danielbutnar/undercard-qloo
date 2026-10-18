import { describe, expect, it } from "vitest";
import {
  assembleLineup,
  type ArtistTag,
  type AssemblyInput,
  type RankedArtist,
} from "@/lib/assemble-lineup";
import {
  lineupWith,
  maskFor,
  switchedLineup,
  venueSwitch,
} from "@/lib/venue-switch";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createQlooClient } from "@/server/qloo";
import { readVenueSwitch } from "@/server/venue-switch";
import { readEvents, syntheticServer } from "../m3/scripted";

// Made-up data: three venues, two bands of two slots, invented ids and names.
const genre = (slug: string, name: string): ArtistTag => ({
  id: `urn:tag:genre:music:${slug}`,
  name,
  type: "urn:tag:genre:music",
});
const INDIE_POP = genre("indie_pop", "Indie Pop");
const ROCK = genre("rock", "Rock");
const DREAM_POP = genre("dream_pop", "Dream Pop");
const JAZZ = genre("jazz", "Jazz");

const A = { entityId: "venue-a", name: "Venue A" };
const B = { entityId: "venue-b", name: "Venue B" };
const C = { entityId: "venue-c", name: "Venue C", kind: "an arena" };

const artist = (
  entityId: string,
  popularity: number,
  affinity: number,
  tags: ArtistTag[],
): RankedArtist => ({
  entityId,
  name: entityId.toUpperCase(),
  popularity,
  affinity,
  tags,
});
const filler = (prefix: string, n: number) =>
  artist(`${prefix}-${n}`, 0.85, 0.1, []);

/** A list of `length` fillers with the given artists at the given positions. */
function ranked(
  prefix: string,
  length: number,
  at: Record<number, RankedArtist>,
): RankedArtist[] {
  return Array.from({ length }, (_, n) => at[n] ?? filler(prefix, n));
}

// Mid: X climbs with A (13th to 1st) and with B (13th to 7th); Y only with A; Z only with B.
// W climbs with C but shares one genre; V climbs with C but is too popular for either band.
const X = (affinity: number) => artist("x", 0.85, affinity, [INDIE_POP, ROCK]);
const Y = artist("y", 0.88, 0.8, [INDIE_POP, DREAM_POP]);
const Z = artist("z", 0.82, 0.6, [ROCK, INDIE_POP]);
const W = artist("w", 0.84, 0.95, [ROCK, JAZZ]);
const V = artist("v", 0.95, 0.5, [INDIE_POP, ROCK]);
// Opener: N isn't in the headliners-only list; C's fans bring it in at 4th.
const N = artist("n", 0.6, 0.7, [INDIE_POP, DREAM_POP]);

const INPUT: AssemblyInput = {
  bands: [
    {
      id: "mid",
      label: "Mid",
      minPopularity: 0.8,
      maxPopularity: 0.92,
      slots: 2,
    },
    {
      id: "opener",
      label: "Opener",
      minPopularity: 0.55,
      maxPopularity: 0.8,
      slots: 2,
    },
  ],
  headliners: [
    { entityId: "h1", name: "H1", tags: [INDIE_POP, ROCK] },
    { entityId: "h2", name: "H2", tags: [INDIE_POP, DREAM_POP] },
  ],
  comparedTags: [{ name: "Indie Pop", score: 0.9 }],
  baselines: {
    mid: ranked("bm", 20, { 10: Y, 12: X(0.5), 13: Z, 14: V, 15: W }),
    opener: ranked("bo", 20, {}),
  },
  venueRuns: [
    { venue: A, band: "mid", artists: ranked("am", 20, { 0: X(0.9), 2: Y }) },
    { venue: B, band: "mid", artists: ranked("bm2", 20, { 5: Z, 6: X(0.7) }) },
    { venue: C, band: "mid", artists: ranked("cm", 20, { 4: V, 5: W }) },
    { venue: C, band: "opener", artists: ranked("co", 20, { 3: N }) },
  ],
};

const on = (...venues: { entityId: string }[]) =>
  new Set(venues.map((venue) => venue.entityId));
const names = (acts: { name: string }[]) => acts.map((act) => act.name);

describe("the venue switch's rule (made-up data)", () => {
  it("with every venue on, books exactly what assembleLineup books", () => {
    const all = lineupWith(INPUT, on(A, B, C));
    const rule = assembleLineup(INPUT);
    expect(all.acts).toEqual(rule.acts);
    expect(all.shortfall).toEqual(rule.shortfall);
    expect(names(all.acts)).toEqual(["X", "Y", "N"]);
    expect(all.shortfall).toEqual({ mid: 0, opener: 1 });
  });

  it("gives each act its place now and its place for the headliners alone", () => {
    const { places } = lineupWith(INPUT, on(A, B, C));
    expect(places.x).toEqual({ now: 1, was: 13 });
    expect(places.y).toEqual({ now: 3, was: 11 });
    // A new entry has no earlier place.
    expect(places.n).toEqual({ now: 4, was: null });
  });

  it("re-forms the lineup when a venue goes off: its acts leave or move to another venue", () => {
    const withoutA = lineupWith(INPUT, on(B, C));
    expect(names(withoutA.acts)).toEqual(["X", "Z", "N"]);
    const x = withoutA.acts.find((act) => act.entityId === "x")!;
    expect(x.anchorVenue).toEqual({ entityId: "venue-b", name: "Venue B" });
    expect(x.reason).toBe("Venue B fans move it up 6 places.");
    expect(x.affinity).toBe(0.7);
    expect(withoutA.places.x).toEqual({ now: 7, was: 13 });
  });

  it("leaves slots open rather than padding them", () => {
    const onlyC = lineupWith(INPUT, on(C));
    // W shares one genre and V is outside both fee ranges, so the mid-size slots stay open.
    expect(names(onlyC.acts)).toEqual(["N"]);
    expect(onlyC.shortfall).toEqual({ mid: 2, opener: 1 });
    expect(onlyC.acts[0].anchorVenue.kind).toBe("an arena");
    const none = lineupWith(INPUT, on());
    expect(none.acts).toEqual([]);
    expect(none.shortfall).toEqual({ mid: 2, opener: 2 });
  });

  it("precomputes every combination of venues, keyed by a mask in the venues' order", () => {
    const data = venueSwitch(INPUT);
    expect(data.venues.map((venue) => venue.entityId)).toEqual([
      "venue-a",
      "venue-b",
      "venue-c",
    ]);
    expect(Object.keys(data.lineups)).toHaveLength(8);
    for (const mask of Object.keys(data.lineups)) {
      const set = new Set(
        data.venues.filter((_, i) => mask[i] === "1").map((v) => v.entityId),
      );
      expect(maskFor(data.venues, set)).toBe(mask);
      expect(switchedLineup(data, set)).toEqual(lineupWith(INPUT, set));
    }
  });
});

describe("the venue switch on a saved build (synthetic Qloo)", () => {
  it("with every venue on equals the saved lineup, read from the Qloo cache with no new call", async () => {
    const server = syntheticServer();
    await readEvents(server.build({ fresh: true }));
    const saved = await server.store.latest(SAGEBRUSH_SOUND.id);
    expect(saved).not.toBeNull();
    const before = server.requests.length;
    const cacheOnly = createQlooClient({
      apiKey: "k",
      cache: server.cache,
      fetch: () => {
        throw new Error("the venue switch must not call Qloo");
      },
      cacheOnly: true,
    });

    const data = await readVenueSwitch({
      store: server.store,
      festival: SAGEBRUSH_SOUND,
      qloo: cacheOnly,
    });
    expect(data).not.toBeNull();
    const everyVenue = new Set(data!.venues.map((venue) => venue.entityId));
    expect(switchedLineup(data!, everyVenue).acts).toEqual(saved!.lineup.acts);
    expect(server.requests.length).toBe(before);

    // Off and on again: some combination differs, and none calls Qloo.
    const masks = Object.keys(data!.lineups);
    expect(masks.length).toBe(2 ** data!.venues.length);
    expect(server.requests.length).toBe(before);
  });

  it("is worked out from the build on screen, names it, and answers nothing for a build it doesn't hold", async () => {
    const server = syntheticServer();
    await readEvents(server.build({ fresh: true }));
    const saved = await server.store.latest(SAGEBRUSH_SOUND.id);
    const cacheOnly = createQlooClient({
      apiKey: "k",
      cache: server.cache,
      fetch: () => {
        throw new Error("the venue switch must not call Qloo");
      },
      cacheOnly: true,
    });
    const asked = await readVenueSwitch({
      store: server.store,
      festival: SAGEBRUSH_SOUND,
      qloo: cacheOnly,
      buildId: saved!.id,
    });
    expect(asked?.buildId).toBe(saved!.id);
    await expect(
      readVenueSwitch({
        store: server.store,
        festival: SAGEBRUSH_SOUND,
        qloo: cacheOnly,
        buildId: "a-live-run-that-was-never-saved",
      }),
    ).resolves.toBeNull();
  });

  it("is unavailable when the Qloo cache can't answer, rather than guessing", async () => {
    const server = syntheticServer();
    await readEvents(server.build({ fresh: true }));
    const emptyCache = createQlooClient({
      apiKey: "k",
      cache: { kind: "memory", get: async () => null, set: async () => {} },
      fetch: () => {
        throw new Error("the venue switch must not call Qloo");
      },
      cacheOnly: true,
    });
    await expect(
      readVenueSwitch({
        store: server.store,
        festival: SAGEBRUSH_SOUND,
        qloo: emptyCache,
      }),
    ).resolves.toBeNull();
  });
});
