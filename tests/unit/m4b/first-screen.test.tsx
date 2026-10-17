// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { firstBoard, IDLE_BUILD } from "@/lib/build-state";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts, FIRST_BILL } from "./first-bill-fixture";

afterEach(cleanup);

describe("the first screen", () => {
  it("opens on the saved bill: every act is on screen before any click", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(screen.queryByText("Open slot")).toBeNull();
  });

  it("falls back to today's empty board and Build undercard when no build is saved", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={null} />);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getAllByText("Open slot")).toHaveLength(10);
    expect(
      screen.getByRole("button", { name: "Build undercard" }),
    ).toBeTruthy();
  });

  it("starts the board from the saved build, so a refill can name it", () => {
    expect(firstBoard(null)).toEqual(IDLE_BUILD);
    expect(firstBoard(FIRST_BILL)).toEqual({
      ...IDLE_BUILD,
      acts,
      build: { ...FIRST_BILL.build, replayed: true },
    });
  });
});
