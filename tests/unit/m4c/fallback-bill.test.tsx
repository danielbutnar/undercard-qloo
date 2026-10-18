// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

afterEach(cleanup);

describe("the first screen with no saved build", () => {
  it("is the bill in its design, its slots open, with Build undercard", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={null} />);
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    expect(
      within(bill)
        .getByRole("list", { name: "Booked headliners" })
        .querySelectorAll("li"),
    ).toHaveLength(2);
    expect(within(bill).getAllByText("Open slot")).toHaveLength(10);
    expect(within(bill).getByText("No undercard drafted yet.")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Undercard draft" })).getByRole(
        "button",
        { name: "Build undercard" },
      ),
    ).toBeTruthy();
    expect(
      within(bill).getByRole("button", { name: "Build undercard" }),
    ).toBeTruthy();
  });

  it("leaves out the rooms rail, with no rooms to count yet", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={null} />);
    expect(
      screen.queryByRole("region", {
        name: "Boise venues whose fans shaped this lineup",
      }),
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "Lineup board" })).toBeNull();
  });
});
