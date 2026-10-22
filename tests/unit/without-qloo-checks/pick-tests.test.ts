// Daniel's brief of 2026-10-22 (prompt-4), step 1: section 31's tests for one model pick, with
// where its popularity sits against the fee range and whether Qloo finds it at all. Invented
// names, ids, tags and numbers.
import { describe, expect, it } from "vitest";
import type { AssemblyInput, RankedArtist } from "@/lib/assemble-lineup";
import { foundOnQloo, pickTests } from "@/lib/pick-tests";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

const genre = (name: string) => ({
  id: `urn:tag:genre:music:${name.toLowerCase().replace(/\W+/g, "_")}`,
  name,
  type: "urn:tag:genre:music",
});
const artist = (
  name: string,
  popularity: number,
  tags: string[] = [],
): RankedArtist => ({
  entityId: `id-${name.toLowerCase().replace(/\W+/g, "-")}`,
  name,
  popularity,
  affinity: 0.5,
  tags: tags.map(genre),
});

// The headliners share Lake Pop and Fuzz Folk. The opening band's headliners-only list has
// "Quiet Harbour" 12th; one venue's list has it 4th. Nothing else is listed anywhere.
const harbour = artist("Quiet Harbour", 0.7, ["Lake Pop", "Fuzz Folk"]);
const INPUT: AssemblyInput = {
  bands: SAGEBRUSH_SOUND.feeBands,
  headliners: [
    { entityId: "h1", name: "H1", tags: [genre("Lake Pop")] },
    { entityId: "h2", name: "H2", tags: [genre("Fuzz Folk")] },
  ],
  comparedTags: [{ name: "Lake Pop", score: 0.7 }],
  baselines: {
    opener: [
      ...Array.from({ length: 11 }, (_, i) => ({ entityId: `base-${i}` })),
      { entityId: harbour.entityId },
    ],
    mid: [],
  },
  venueRuns: [
    {
      venue: { entityId: "v1", name: "The Tin Shed" },
      band: "opener",
      artists: [
        ...Array.from({ length: 3 }, (_, i) => artist(`Filler ${i}`, 0.7)),
        harbour,
      ],
    },
  ],
};

describe("where a pick's popularity sits against the fee range (0.55-0.92)", () => {
  it("reads in, above or below, with both edges inside", () => {
    const range = (popularity: number) =>
      pickTests(INPUT, artist("Somebody", popularity)).range;
    expect(range(0.97)).toBe("above");
    expect(range(0.9201)).toBe("above");
    expect(range(0.92)).toBe("in");
    expect(range(0.86)).toBe("in");
    expect(range(0.62)).toBe("in");
    expect(range(0.55)).toBe("in");
    expect(range(0.5499)).toBe("below");
    expect(range(0.31)).toBe("below");
  });

  it("leaves the other tests as they were", () => {
    expect(pickTests(INPUT, harbour)).toEqual({
      inFeeRange: true,
      range: "in",
      genres: 2,
      climb: 8,
      passes: true,
    });
    expect(
      pickTests(
        INPUT,
        artist("Big Sky Choir", 0.95, ["Lake Pop", "Fuzz Folk"]),
      ),
    ).toEqual({
      inFeeRange: false,
      range: "above",
      genres: 2,
      climb: null,
      passes: false,
    });
  });
});

describe("a pick found on Qloo: search's top five, after section 18's normalising", () => {
  const results = [
    artist("Paper Lanterns", 0.8),
    artist("The Velvet Coyote", 0.9),
    artist("Cafe Lumen (US)", 0.6),
    artist("Dune Static", 0.7),
    artist("Moth Radio", 0.75),
    artist("Sixth Place", 0.7),
  ];

  it("matches through accents, case, a leading The and a bracketed note", () => {
    expect(foundOnQloo("velvet coyote", results)?.name).toBe(
      "The Velvet Coyote",
    );
    expect(foundOnQloo("Café Lumen", results)?.name).toBe("Cafe Lumen (US)");
    expect(foundOnQloo("DUNE STATIC", results)?.name).toBe("Dune Static");
  });

  it("doesn't find a pick none of the top five matches", () => {
    expect(foundOnQloo("Nobody By That Name", results)).toBeNull();
    expect(foundOnQloo("Sixth Place", results)).toBeNull();
    expect(foundOnQloo("Paper Lantern", results)).toBeNull();
    expect(foundOnQloo("Anything", [])).toBeNull();
  });
});
