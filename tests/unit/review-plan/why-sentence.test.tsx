// @vitest-environment jsdom
// Plan.md item 5 (the review's D3, prompt D's shape): an expanded act says why it's on the
// lineup in one sentence, from the saved build's numbers only. Synthetic acts and places.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActCard } from "@/components/act-card";
import { whySentence } from "@/components/chart/why";
import { acts } from "../m4b/first-bill-fixture";

afterEach(cleanup);

const climber = {
  ...acts[0],
  name: "Synthetic Climber",
  anchorVenue: { entityId: "v1", name: "The Lantern Room" },
  reason: "The Lantern Room fans move it up 15 places.",
};
const fresh = {
  ...acts[1],
  name: "Synthetic Newcomer",
  anchorVenue: { entityId: "v2", name: "Fort Street Hall" },
  reason: "Fort Street Hall fans move it into the top 29.",
};

describe("an act's why, in one sentence (plan.md item 5)", () => {
  it("names the venue's place, the headliners' place and the climb", () => {
    expect(whySentence(climber, { now: 6, was: 21 })).toBe(
      "Fans of The Lantern Room rank Synthetic Climber 6th; fans of the headliners alone rank them 21st. That climb of 15 is why Synthetic Climber is here.",
    );
  });

  it("says a new entry wasn't in the headliners' top 50", () => {
    expect(whySentence(fresh, { now: 29, was: null })).toBe(
      "Fans of Fort Street Hall rank Synthetic Newcomer 29th; fans of the headliners alone don't rank them in their top 50. That climb into the top 50 is why Synthetic Newcomer is here.",
    );
  });

  it("keeps the build's own line where the places aren't saved", () => {
    expect(whySentence(climber, null)).toBe(climber.reason);
  });

  it("is the card's Why line", () => {
    render(
      <ActCard
        act={climber}
        hue={0}
        city="Boise"
        place={{ now: 6, was: 21 }}
      />,
    );
    const card = screen.getByRole("article", { name: "Synthetic Climber" });
    expect(within(card).getByText("Why Boise:")).toBeTruthy();
    expect(card.textContent).toContain(
      "Fans of The Lantern Room rank Synthetic Climber 6th; fans of the headliners alone rank them 21st. That climb of 15 is why Synthetic Climber is here.",
    );
  });
});
