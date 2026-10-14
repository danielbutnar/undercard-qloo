import { describe, expect, it } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import { feeBandFor } from "@/lib/fee-bands";
import { actsInBand, LineupSchema } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

const lineup = LineupSchema.parse(fixture);
const SYNTHETIC_ID = /^00000000-0000-4000-8000-\d{12}$/;

describe("tests/fixtures/lineup.synthetic.json", () => {
  it("is a Sagebrush Sound lineup of 10 acts", () => {
    expect(lineup.festivalId).toBe(SAGEBRUSH_SOUND.id);
    expect(lineup.acts).toHaveLength(10);
  });

  it("fills each fee band's slots: 4 Mid and 6 Opener", () => {
    for (const band of SAGEBRUSH_SOUND.feeBands) {
      expect(actsInBand(lineup.acts, band.id)).toHaveLength(band.slots);
    }
  });

  it("bands every act by its popularity percentile", () => {
    for (const act of lineup.acts) {
      expect(feeBandFor(act.popularity, SAGEBRUSH_SOUND.feeBands)?.id).toBe(
        act.band,
      );
    }
  });

  it("names the anchor venue in every Why Boise line", () => {
    for (const act of lineup.acts) {
      expect(act.reason).toContain(act.anchorVenue.name);
    }
  });

  it("gives every act two distinct shared tags", () => {
    for (const act of lineup.acts) {
      const [first, second] = act.sharedTags;
      expect(first.id).not.toBe(second.id);
    }
  });

  it("holds only synthetic entity ids, never Qloo response data", () => {
    const ids = lineup.acts.flatMap((act) => [
      act.entityId,
      act.anchorVenue.entityId,
    ]);
    for (const id of ids) expect(id).toMatch(SYNTHETIC_ID);
    const actIds = lineup.acts.map((act) => act.entityId);
    expect(new Set(actIds).size).toBe(actIds.length);
  });
});

describe("LineupSchema", () => {
  const act = lineup.acts[0];

  it("rejects an act with only one shared tag", () => {
    const broken = { ...act, sharedTags: [act.sharedTags[0]] };
    expect(LineupSchema.safeParse({ ...lineup, acts: [broken] }).success).toBe(
      false,
    );
  });

  it("rejects affinity or popularity outside 0 to 1", () => {
    for (const broken of [
      { ...act, affinity: 1.2 },
      { ...act, popularity: -0.1 },
    ]) {
      expect(
        LineupSchema.safeParse({ ...lineup, acts: [broken] }).success,
      ).toBe(false);
    }
  });

  it("rejects a band the buyer has not set", () => {
    const broken = { ...act, band: "headliner" };
    expect(LineupSchema.safeParse({ ...lineup, acts: [broken] }).success).toBe(
      false,
    );
  });
});

describe("actsInBand", () => {
  it("returns a band's acts strongest affinity first", () => {
    const affinities = actsInBand(lineup.acts, "opener").map(
      (act) => act.affinity,
    );
    expect(affinities).toEqual([...affinities].sort((a, b) => b - a));
  });
});
