// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

afterEach(cleanup);

describe("FestivalScreen for Sagebrush Sound", () => {
  it("shows the festival, its city, capacity and crowd", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Sagebrush Sound" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Boise, Idaho · 3,000 capacity · crowd aged 25–34"),
    ).toBeTruthy();
  });

  it("shows both booked headliners", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    const headliners = screen.getByRole("list", { name: "Booked headliners" });
    expect(
      within(headliners)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Khruangbin", "Japanese Breakfast"]);
  });

  it("shows both fee bands", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    expect(screen.getByRole("region", { name: /^Mid/ })).toBeTruthy();
    expect(screen.getByRole("region", { name: /^Opener/ })).toBeTruthy();
  });

  it("draws the 30-day presale sparkline with tickets sold", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    const sparkline = screen.getByRole("img", {
      name: /Presale over the last 30 days/,
    });
    expect(
      sparkline.querySelector("polyline")?.getAttribute("points")?.split(" "),
    ).toHaveLength(30);
    expect(screen.getByText("1,450")).toBeTruthy();
    expect(screen.getByText(/sold of 3,000/)).toBeTruthy();
  });

  it("keeps a table of the daily presale counts for screen readers", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    const table = screen.getByRole("table", { name: /Presale by day/ });
    expect(within(table).getAllByRole("row")).toHaveLength(31);
  });

  it("offers Build undercard and an empty Qloo call trace", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    expect(
      screen.getByRole("button", { name: "Build undercard" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Qloo calls" })).toBeTruthy();
  });
});
