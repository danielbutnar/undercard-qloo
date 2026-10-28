// WS13 item 6: search that survives accents (WS8's folded retry is in place) chooses between
// several matches by tags: when two acts share a name, the one whose genres the headliners
// share most. Invented names and tags only.
import { describe, expect, it } from "vitest";
import {
  headlinerTagWeights,
  type ArtistTag,
  type AssemblyInput,
} from "@/lib/assemble-lineup";
import { foundOnQloo } from "@/lib/pick-tests";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { resolveNames } from "@/server/shortlist";
import type { QlooClient } from "@/server/qloo";

const genre = (slug: string, name: string): ArtistTag => ({
  id: `urn:tag:genre:music:${slug}`,
  name,
  type: "urn:tag:genre:music",
});
const DREAM_POP = genre("dream_pop", "Dream Pop");
const INDIE_ROCK = genre("indie_rock", "Indie Rock");
const JAZZ = genre("jazz", "Jazz");
const METAL = genre("metal", "Metal");

const artist = (entityId: string, name: string, tags: ArtistTag[]) => ({
  entityId,
  name,
  popularity: 0.7,
  affinity: null,
  tags,
});

// The headliners' taste: dream pop and indie rock.
const INPUT: AssemblyInput = {
  bands: SAGEBRUSH_SOUND.feeBands,
  headliners: [
    { entityId: "h1", name: "Headliner One", tags: [DREAM_POP, INDIE_ROCK] },
    { entityId: "h2", name: "Headliner Two", tags: [DREAM_POP] },
  ],
  comparedTags: [{ name: "Dream Pop", score: 0.9 }],
  baselines: {},
  venueRuns: [],
};
const weights = headlinerTagWeights(INPUT);

// Two acts called Hollow Pines: a jazz trio Qloo lists first, a dream-pop band second.
const JAZZ_TRIO = artist("jazz-trio", "Hollow Pines", [JAZZ]);
const DREAM_BAND = artist("dream-band", "Hollow Pines", [
  DREAM_POP,
  INDIE_ROCK,
]);

describe("choosing between same-name matches by tags (WS13.6)", () => {
  it("takes the one whose genres the headliners share most, wherever Qloo lists it", () => {
    expect(
      foundOnQloo("Hollow Pines", [JAZZ_TRIO, DREAM_BAND], weights)?.entityId,
    ).toBe("dream-band");
    expect(
      foundOnQloo("Hollow Pines", [DREAM_BAND, JAZZ_TRIO], weights)?.entityId,
    ).toBe("dream-band");
  });

  it("keeps Qloo's order on a tie, and without the headliners' tags", () => {
    const metal = artist("metal-band", "Hollow Pines", [METAL]);
    expect(
      foundOnQloo("Hollow Pines", [JAZZ_TRIO, metal], weights)?.entityId,
    ).toBe("jazz-trio");
    expect(foundOnQloo("Hollow Pines", [JAZZ_TRIO, DREAM_BAND])?.entityId).toBe(
      "jazz-trio",
    );
  });

  it("still needs the name: a better-tagged act with another name is never taken", () => {
    const other = artist("other", "Hollow Pine Trees", [DREAM_POP, INDIE_ROCK]);
    expect(
      foundOnQloo("Hollow Pines", [other, JAZZ_TRIO], weights)?.entityId,
    ).toBe("jazz-trio");
    expect(foundOnQloo("Hollow Pines", [other], weights)).toBeNull();
  });

  it("chooses among Qloo's top five only", () => {
    const fillers = Array.from({ length: 4 }, (_, n) =>
      artist(`filler-${n}`, `Filler ${n}`, []),
    );
    expect(
      foundOnQloo("Hollow Pines", [JAZZ_TRIO, ...fillers, DREAM_BAND], weights)
        ?.entityId,
    ).toBe("jazz-trio");
  });

  it("is how the shortlist resolves a pasted name, with the build's headliners' tags", async () => {
    const qloo = {
      search: async () => ({
        data: [JAZZ_TRIO, DREAM_BAND],
        call: {
          path: "/search",
          params: [],
          resultCount: 2,
          ms: 1,
          cached: true,
        },
      }),
    } as unknown as QlooClient;
    const { acts } = await resolveNames({
      names: ["Hollow Pines"],
      budget: {
        run: async (jobs) => Promise.all(jobs.map((job) => job(qloo))),
      } as Parameters<typeof resolveNames>[0]["budget"],
      headlinerIds: new Set(),
      tagWeights: weights,
    });
    expect(acts[0]).toMatchObject({
      status: "found",
      artist: { entityId: "dream-band" },
    });
  });
});
