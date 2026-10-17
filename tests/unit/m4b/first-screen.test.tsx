// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("falls back to the bill with open slots and Build undercard when no build is saved", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={null} />);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getAllByText("Open slot")).toHaveLength(10);
    expect(
      within(
        screen.getByRole("complementary", { name: "Qloo calls" }),
      ).getByRole("button", { name: "Build undercard" }),
    ).toBeTruthy();
  });

  it("leaves presale off the first screen, with or without a saved bill", () => {
    for (const firstBill of [FIRST_BILL, null]) {
      render(
        <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={firstBill} />,
      );
      expect(screen.queryByRole("img", { name: /Presale/ })).toBeNull();
      expect(screen.queryByText(/sold of/)).toBeNull();
      cleanup();
    }
  });

  it("puts Export CSV below the bill once there's a lineup, and none on the empty board (M6q)", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(
      within(screen.getByRole("banner")).queryByRole("button", {
        name: "Export CSV",
      }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeTruthy();
    cleanup();
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={null} />);
    expect(screen.queryByRole("button", { name: "Export CSV" })).toBeNull();
  });

  it("keeps the bill on screen, in open slots, while a replay waits for its first event", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    fireEvent.click(
      within(
        screen.getByRole("complementary", { name: "Qloo calls" }),
      ).getByRole("button", { name: "Watch how it picked these acts" }),
    );
    expect(
      screen.getByRole("region", { name: "Undercard draft" }),
    ).toBeTruthy();
    expect(screen.getAllByText("Open slot")).toHaveLength(10);
    expect(screen.queryByRole("region", { name: "Lineup board" })).toBeNull();
    vi.unstubAllGlobals();
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
