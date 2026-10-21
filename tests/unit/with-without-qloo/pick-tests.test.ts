// Evidence section 31: the three tests every act on a Qloo lineup passes, read for any artist
// (a model's pick found on Qloo) the way the booking rule reads them. Synthetic ids and tags.
import { describe, expect, it } from "vitest";
import type { AssemblyInput, RankedArtist } from "@/lib/assemble-lineup";
import { pickTests } from "@/lib/pick-tests";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

const genre = (name: string) => ({
  id: `urn:tag:genre:music:${name.toLowerCase().replace(/\W+/g, "_")}`,
  name,
  type: "urn:tag:genre:music",
});
const artist = (
  entityId: string,
  popularity: number,
  tags: string[],
): RankedArtist => ({
  entityId,
  name: entityId,
  popularity,
  affinity: 0.5,
  tags: tags.map(genre),
});
const filler = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => artist(`${prefix}${i}`, 0.85, []));

// The headliners share Indie Rock and Dream Pop. Mid's headliners-only list has "climber" 20th;
// one venue's list has it 3rd and has "fresh", which the headliners-only list doesn't have.
const baselineMid = [...filler(19, "b"), artist("climber", 0.85, [])];
const INPUT: AssemblyInput = {
  bands: SAGEBRUSH_SOUND.feeBands,
  headliners: [
    {
      entityId: "h1",
      name: "H1",
      tags: [genre("Indie Rock"), genre("Dream Pop")],
    },
    {
      entityId: "h2",
      name: "H2",
      tags: [genre("Indie Rock"), genre("Dream Pop")],
    },
  ],
  comparedTags: [],
  baselines: { mid: baselineMid, opener: [] },
  venueRuns: [
    {
      venue: { entityId: "v1", name: "Venue One" },
      band: "mid",
      artists: [
        ...filler(2, "x"),
        artist("climber", 0.85, ["Indie Rock", "Dream Pop"]),
        artist("fresh", 0.85, ["Indie Rock"]),
      ],
    },
  ],
};

describe("the three tests, for any artist (evidence section 31)", () => {
  it("passes an act inside a band, with two of the headliners' genres, that a venue's fans lift", () => {
    expect(
      pickTests(INPUT, artist("climber", 0.85, ["Indie Rock", "Dream Pop"])),
    ).toEqual({ inFeeRange: true, genres: 2, climb: 17, passes: true });
  });

  it("counts a place in a venue's list as a climb when the headliners-only list didn't have it", () => {
    const tests = pickTests(INPUT, artist("fresh", 0.85, ["Indie Rock"]));
    expect(tests.climb).toBe(20 - 3);
    expect(tests.genres).toBe(1);
    expect(tests.passes).toBe(false);
  });

  it("fails an act above or below the bands, and one no venue's list holds", () => {
    expect(
      pickTests(INPUT, artist("big", 0.95, ["Indie Rock", "Dream Pop"])),
    ).toEqual({ inFeeRange: false, genres: 2, climb: null, passes: false });
    expect(pickTests(INPUT, artist("small", 0.4, [])).inFeeRange).toBe(false);
  });
});
