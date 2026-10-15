import { describe, expect, it } from "vitest";
import {
  assembleLineup,
  type AssemblyInput,
  type RankedArtist,
} from "@/lib/assemble-lineup";
import { feeBandFor } from "@/lib/fee-bands";
import { LineupSchema } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tag = (slug: string, name: string, type = "urn:tag:genre:music") => ({
  id: `${type}:${slug}`,
  name,
  type,
});
const DREAM = tag("dream_pop", "Dream Pop");
const INDIE = tag("indie_rock", "Indie Rock");
const PSYCH = tag("psychedelic_rock", "Psychedelic Rock");
const POLKA = tag("polka", "Polka");

const LANTERN = { entityId: id(201), name: "The Lantern Room" };
const FORT = { entityId: id(202), name: "Fort Street Ballroom" };

function artist(
  n: number,
  popularity: number,
  tags = [DREAM, INDIE],
): RankedArtist {
  return { entityId: id(n), name: `Act ${n}`, popularity, affinity: 0.9, tags };
}

function withAffinity(list: RankedArtist[]) {
  return list.map((entry, position) => ({
    ...entry,
    affinity: 0.95 - position * 0.001,
  }));
}

// Baseline: acts 1..20 in order. The Lantern Room reverses the list; Fort Street Ballroom
// leaves it alone (a venue with no signal).
function input(overrides: Partial<AssemblyInput> = {}): AssemblyInput {
  const mid = Array.from({ length: 20 }, (_, i) =>
    artist(100 + i, 0.9 - i * 0.004),
  );
  const opener = Array.from({ length: 20 }, (_, i) =>
    artist(300 + i, 0.78 - i * 0.01),
  );
  return {
    bands: SAGEBRUSH_SOUND.feeBands,
    headliners: [
      { entityId: id(1), name: "Headliner One", tags: [DREAM, INDIE, PSYCH] },
      { entityId: id(2), name: "Headliner Two", tags: [DREAM, PSYCH] },
    ],
    comparedTags: [{ name: "Psychedelic Rock", score: 0.9 }],
    baselines: { mid: withAffinity(mid), opener: withAffinity(opener) },
    venueRuns: [
      {
        venue: LANTERN,
        band: "mid",
        artists: withAffinity([...mid].reverse()),
      },
      {
        venue: LANTERN,
        band: "opener",
        artists: withAffinity([...opener].reverse()),
      },
      { venue: FORT, band: "mid", artists: withAffinity(mid) },
      { venue: FORT, band: "opener", artists: withAffinity(opener) },
    ],
    ...overrides,
  };
}

describe("assembleLineup", () => {
  it("fills 4 Mid and 6 Opener slots with valid acts", () => {
    const { acts, shortfall } = assembleLineup(input());
    expect(
      LineupSchema.parse({ festivalId: "sagebrush-sound", acts }).acts,
    ).toHaveLength(10);
    expect(acts.filter((act) => act.band === "mid")).toHaveLength(4);
    expect(acts.filter((act) => act.band === "opener")).toHaveLength(6);
    expect(shortfall).toEqual({ mid: 0, opener: 0 });
  });

  it("only books acts a venue lifts at least five places above the headliners-only baseline", () => {
    const { acts } = assembleLineup(input());
    // Reversing 20 acts lifts baseline rank r by 2r - 19, so only ranks 12 and up clear 5.
    const midIds = acts
      .filter((act) => act.band === "mid")
      .map((act) => act.entityId);
    for (const entityId of midIds)
      expect(Number(entityId.slice(-3)) - 100).toBeGreaterThanOrEqual(12);
  });

  it("anchors each act on the venue that lifts it, and names the venue in the Why Boise line", () => {
    const { acts } = assembleLineup(input());
    for (const act of acts) {
      expect(act.anchorVenue).toEqual(LANTERN);
      expect(act.reason).toContain("The Lantern Room");
      expect(act.reason).toMatch(/moves? it up \d+ places/);
    }
  });

  it("keeps each act in the fee band its popularity maps to", () => {
    for (const act of assembleLineup(input()).acts) {
      expect(feeBandFor(act.popularity, SAGEBRUSH_SOUND.feeBands)?.id).toBe(
        act.band,
      );
    }
  });

  it("shows two tags each act shares with the headliners, shared-by-both first", () => {
    const { acts } = assembleLineup(input());
    expect(acts[0].sharedTags.map((t) => t.name)).toEqual([
      "Dream Pop",
      "Indie Rock",
    ]);
  });

  it("skips acts that share fewer than two tags with the headliners", () => {
    const base = input();
    const runs = base.venueRuns.map((run) => ({
      ...run,
      artists: run.artists.map((entry) =>
        entry.entityId === id(119) ? { ...entry, tags: [DREAM, POLKA] } : entry,
      ),
    }));
    const { acts } = assembleLineup({ ...base, venueRuns: runs });
    expect(acts.map((act) => act.entityId)).not.toContain(id(119));
  });

  it("never books a headliner", () => {
    const base = input();
    const runs = base.venueRuns.map((run) =>
      run.band === "mid"
        ? {
            ...run,
            artists: [{ ...artist(1, 0.85), affinity: 0.99 }, ...run.artists],
          }
        : run,
    );
    const { acts } = assembleLineup({ ...base, venueRuns: runs });
    expect(acts.map((act) => act.entityId)).not.toContain(id(1));
  });

  it("reports a shortfall instead of padding the board with unlifted acts", () => {
    const base = input();
    const { acts, shortfall } = assembleLineup({
      ...base,
      venueRuns: base.venueRuns.filter(
        (run) => run.venue.entityId === FORT.entityId,
      ),
    });
    expect(acts).toHaveLength(0);
    expect(shortfall).toEqual({ mid: 4, opener: 6 });
  });

  it("says 'into the top N' for an act the baseline doesn't rank at all", () => {
    const base = input();
    const newcomer = { ...artist(777, 0.85), affinity: 0.99 };
    const runs = base.venueRuns.map((run) =>
      run.venue === LANTERN && run.band === "mid"
        ? { ...run, artists: [newcomer, ...run.artists] }
        : run,
    );
    const act = assembleLineup({ ...base, venueRuns: runs }).acts.find(
      (a) => a.entityId === id(777),
    );
    expect(act?.reason).toBe("The Lantern Room fans move it into the top 1.");
  });
});
