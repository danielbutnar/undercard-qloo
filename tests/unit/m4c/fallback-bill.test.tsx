// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

afterEach(cleanup);

describe("the first screen with no saved build", () => {
  it("is the chart in its design, its slots open, with Build undercard", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={null} />);
    const draft = screen.getByRole("region", { name: "Undercard draft" });
    expect(
      within(draft)
        .getByRole("list", { name: "Booked headliners" })
        .querySelectorAll("li"),
    ).toHaveLength(2);
    expect(within(draft).getAllByText("Open slot")).toHaveLength(10);
    expect(within(draft).getByText("No undercard drafted yet.")).toBeTruthy();
    // The button sits after the lead, ahead of the poster, not inside it, and is the only one.
    expect(
      screen.getAllByRole("button", { name: "Build undercard" }),
    ).toHaveLength(1);
    const button = screen.getByRole("button", { name: "Build undercard" });
    expect(
      screen
        .getByRole("region", { name: "What Undercard does" })
        .compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(draft).queryByRole("button", { name: "Build undercard" }),
    ).toBeNull();
  });

  it("leaves out the venue switch, with no venues to count yet", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={null} />);
    expect(
      screen.queryByRole("region", {
        name: "Boise venues whose fans shaped this lineup",
      }),
    ).toBeNull();
    expect(screen.queryByRole("region", { name: "Lineup board" })).toBeNull();
  });
});
