// @vitest-environment jsdom
// WS12 item 3: the act card, finished, on the synthetic lineup (invented acts and venues): its
// rank beside its climb as the poster prints them, "with <venue>'s fans added", its popularity on
// its tier's own scale, both climbs from WS13.3's data, and its actions (pinned by the panel).
import { climbsLine } from "@/lib/agent-words";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActCard } from "@/components/act-card";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts } from "../m4b/first-bill-fixture";

afterEach(cleanup);

const act = acts[0]; // the first mid-size act, up 11 with its venue's fans
const band = SAGEBRUSH_SOUND.feeBands[0];
const open = (extra: Partial<typeof act> = {}) =>
  render(
    <ActCard
      act={{ ...act, ...extra }}
      place={{ now: 3, was: 14 }}
      band={band}
      hue={0}
      onKeep={() => {}}
      onUnavailable={() => {}}
      onClose={() => {}}
    />,
  );

describe("the act card, finished (WS12 item 3)", () => {
  it("leads with its rank beside its climb, with its venue's fans added", () => {
    open();
    const rank = screen.getByText("3rd").parentElement!;
    expect(rank.textContent).toContain("↑11");
    expect(rank.textContent).toContain(
      `in Qloo's ranking with ${act.anchorVenue.name}'s fans added`,
    );
    expect(document.body.textContent).toContain(
      "14th for the headliners' fans alone",
    );
  });

  it("puts its popularity on its tier's own scale, not on 0 to 100", () => {
    open();
    const scale = screen.getByRole("img", {
      name: /on the mid-size tier's scale/,
    });
    expect(scale.getAttribute("aria-label")).toBe(
      `Popularity ${Math.floor(act.popularity * 100)} on the mid-size tier's scale, 80 to 92`,
    );
    // The demo path reads the figure, then its words, then the scale (SPEC section 3, step 3).
    expect(document.body.textContent).toMatch(
      /Popularity\d{1,2}popularity on Qloo, inside the mid-size fee range \(80–92\)80/,
    );
  });

  it("shows both climbs once WS13.3's data carries them", () => {
    const localLift = {
      venueClimb: 11,
      controlClimb: 4,
      control: { entityId: "c-1", name: "A Room Abroad", town: "Elsewhere" },
    };
    open({ localLift });
    // In WS13's own words (climbsLine), whatever they become (Daniel, 2026-10-28).
    expect(document.body.textContent).toContain(
      climbsLine({ ...act, localLift })!,
    );
  });

  it("keeps Keep and Unavailable", () => {
    open();
    expect(screen.getByRole("button", { name: "Keep" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeTruthy();
  });
});
