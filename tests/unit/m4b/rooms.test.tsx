// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

afterEach(cleanup);

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

describe("the rooms rail", () => {
  const rail = () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    return screen.getByRole("region", {
      name: "Boise crowds behind this bill",
    });
  };

  it("says how many places Qloo listed and how many rooms the agent tested", () => {
    expect(
      within(rail()).getByText(
        /^Qloo listed 8 Boise live-music places; the agent tested 3 of their crowds against the headliners' fans\./,
      ),
    ).toBeTruthy();
  });

  it("says a room stands for its crowd, not a stage the acts will play", () => {
    expect(
      within(rail()).getByText(
        /A room here means its crowd, not a stage the acts will play\./,
      ),
    ).toBeTruthy();
  });

  it("gives each room its count of acts lifted, a zero included", () => {
    const rooms = within(rail()).getAllByRole("listitem");
    expect(rooms.map((room) => room.textContent)).toEqual([
      "The Lantern Room7 acts liftedtested for Mid and Opener",
      "Fort Street Ballroom3 acts liftedFSB · tested for Mid and Opener",
      "Cottonwood Social Hall0 lifted noneCSH · tested for Mid",
    ]);
  });

  it("makes way for an open act's card", () => {
    rail();
    within(screen.getByRole("region", { name: "Undercard draft" }))
      .getByRole("button", { name: "Hollow Pines" })
      .click();
    return Promise.resolve().then(() => {
      expect(
        screen.queryByRole("region", { name: "Boise crowds behind this bill" }),
      ).toBeNull();
    });
  });
});
