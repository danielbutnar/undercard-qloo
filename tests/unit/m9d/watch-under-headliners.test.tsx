// @vitest-environment jsdom
// After M9d (docs/evidence.md section 25): Watch sits directly under the headliners at every
// width, the rail carries no copy of it, and the first sentence is split in two.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(cleanup);

const WATCH = { name: "Watch how it picked these acts" };
const open = () =>
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);

describe("Watch under the headliners (section 25)", () => {
  it("is one button, under the headliners and above the first band, shown at every width", () => {
    open();
    const buttons = screen.getAllByRole("button", WATCH);
    expect(buttons).toHaveLength(1);
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    const button = within(bill).getByRole("button", WATCH);
    // jsdom applies no CSS: no ancestor may hide it at some width.
    expect(button.closest("[class*='hidden']")).toBeNull();
    const headliners = within(bill).getByRole("list", {
      name: "Booked headliners",
    });
    const firstBand = within(bill).getByRole("region", {
      name: "Mid-size acts",
    });
    expect(
      headliners.compareDocumentPosition(button) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      button.compareDocumentPosition(firstBand) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(
        screen.getByRole("complementary", { name: "Qloo calls" }),
      ).queryByRole("button", WATCH),
    ).toBeNull();
  });

  it("says what Undercard does, then, in a second sentence, where its data comes from", () => {
    open();
    const first = screen.getByRole("banner").querySelector("p")!;
    expect(first.textContent).toBe(
      "Undercard is an AI agent that helps a music festival choose the smaller acts that play before the stars, using what fans of the town's own music venues already like. It reads that from Qloo, a taste-data service that maps what fans of one artist, venue or film also like.",
    );
  });
});
