// M10b: what How it works follows through the saved build (docs/evidence.md section 28), on the
// synthetic lineup: invented acts and venues, no Qloo data.
import { describe, expect, it } from "vitest";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

const PLACES = { [acts[0].entityId]: { now: 3, was: 14 } }; // Hollow Pines, up 11

describe("the act How it works follows (M10b)", () => {
  it("is the first mid-size act on the saved lineup, with its places, climb and venue", () => {
    const story = methodStory(SAGEBRUSH_SOUND, {
      ...FIRST_BILL,
      places: PLACES,
    })!;
    expect(story.act.name).toBe("Hollow Pines");
    expect(story.band.id).toBe("mid");
    expect(story.place).toEqual({ now: 3, was: 14 });
    expect(story.climb).toBe(11);
    expect(story.fresh).toBe(false);
    expect(story.act.anchorVenue.name).toBe("The Lantern Room");
  });

  it("lists the venues the AI agent read, in its order, with the acts each put on the lineup", () => {
    const story = methodStory(SAGEBRUSH_SOUND, FIRST_BILL)!;
    expect(story.venues.map((venue) => [venue.name, venue.lifted])).toEqual([
      ["The Lantern Room", 7],
      ["Fort Street Ballroom", 3],
      ["Cottonwood Social Hall", 0],
    ]);
    expect(story.calls).toBe(12);
    expect(story.placesListed).toBe(8);
    expect(story.buildId).toBe(FIRST_BILL.build.id);
  });

  it("is null without a saved build, or without a mid-size act on it", () => {
    expect(methodStory(SAGEBRUSH_SOUND, null)).toBeNull();
    expect(
      methodStory(SAGEBRUSH_SOUND, {
        ...FIRST_BILL,
        acts: acts.filter((act) => act.band !== "mid"),
      }),
    ).toBeNull();
  });
});
