// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { roomsBehind } from "@/lib/rooms";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import {
  acts,
  COTTONWOOD,
  FIRST_BILL,
  FORT,
  LANTERN,
} from "./first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the rooms behind the bill", () => {
  it("counts the acts each tested room lifted, most first, with the bands it was tested for", () => {
    expect(roomsBehind(acts, FIRST_BILL.anchors)).toEqual([
      { venue: LANTERN, short: null, bands: ["mid", "opener"], lifted: 7 },
      { venue: FORT, short: "FSB", bands: ["mid", "opener"], lifted: 3 },
      { venue: COTTONWOOD, short: "CSH", bands: ["mid"], lifted: 0 },
    ]);
  });

  it("leaves an unavailable act out of its room's count", () => {
    const [lantern] = roomsBehind(acts, FIRST_BILL.anchors, [acts[0].entityId]);
    expect(lantern.lifted).toBe(6);
  });

  it("lists a room an act names even when the build didn't record it as tested", () => {
    expect(roomsBehind(acts, {}).map((room) => room.venue.name)).toEqual([
      "The Lantern Room",
      "Fort Street Ballroom",
    ]);
  });
});

// The rooms rail became the venue switch beside the chart; since WS12 item 1 the switch is the
// poster's key alone: the town's legend says what was read, the key counts each venue's acts and
// says, under it, what switching one off does and what the venues stand for.
describe("the venues, in the town's legend and the poster's key", () => {
  const open = () =>
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );

  it("says how many places Qloo listed and how many venues the agent read", () => {
    open();
    expect(
      screen.getByRole("region", { name: "Your town" }).textContent,
    ).toContain(
      "Qloo listed 8 live-music places in Boise. The AI agent tested these 3 venues.",
    );
  });

  // Daniel, 2026-10-28: the venues' fans are the signal; "stand for the town's taste" is a claim
  // section 37's limit says isn't shown.
  it("says the venues' fans are the signal, not a stage the acts will play", () => {
    open();
    const poster = screen.getByRole("region", { name: "Undercard draft" });
    expect(poster.textContent).toContain(
      "These venues' fans are the signal: the acts won't necessarily play there.",
    );
    expect(poster.textContent).not.toContain("stand for the town's taste");
  });

  it("gives each venue its count of acts lifted, a zero included", () => {
    open();
    const key = screen.getByRole("group", {
      name: "Venue fans used for this draft",
    });
    expect(
      [...key.querySelectorAll("[aria-label]")].map((venue) =>
        venue.getAttribute("aria-label"),
      ),
    ).toEqual([
      "The Lantern Room's fans: 7 acts",
      "Fort Street Ballroom's fans: 3 acts",
      "Cottonwood Social Hall's fans: 0 acts",
    ]);
  });
});
