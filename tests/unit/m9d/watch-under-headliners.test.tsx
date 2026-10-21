// @vitest-environment jsdom
// After M9d (docs/evidence.md section 25) and the weekly chart: Watch sits in the lead, ahead of
// the chart in reading order and beside it at desktop widths, at every width; no other panel
// carries a copy of it; and the lead's first sentence is split in two.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(cleanup);

const WATCH = { name: "Watch how it picked these acts" };
const open = () =>
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);

describe("Watch in the lead (section 25)", () => {
  it("is one button, in the lead and ahead of the first band, shown at every width", () => {
    open();
    expect(screen.getAllByRole("button", WATCH)).toHaveLength(1);
    const lead = screen.getByRole("region", { name: "What Undercard does" });
    const button = within(lead).getByRole("button", WATCH);
    // jsdom applies no CSS: no ancestor may hide it at some width.
    expect(button.closest("[class*='hidden']")).toBeNull();
    const firstBand = screen.getByRole("region", { name: "Mid-size acts" });
    expect(
      button.compareDocumentPosition(firstBand) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The lead is the first thing on the page after the top bar, not a panel beside the chart.
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    expect(
      lead.compareDocumentPosition(bill) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      within(
        screen.getByRole("complementary", { name: "Qloo calls" }),
      ).queryByRole("button", WATCH),
    ).toBeNull();
  });

  it("says what Undercard does, then, in a second sentence, what Qloo is", () => {
    open();
    const lead = screen.getByRole("region", { name: "What Undercard does" });
    const [headline, what, ...rest] = [...lead.querySelectorAll("p")].map(
      (p) => p.textContent,
    );
    expect(headline).toBe(
      "A festival lineup, drafted from Boise's own music venues.",
    );
    expect(what).toBe(
      "Undercard is an AI agent: it drafts the acts that play before the headliners from what fans of the town's own venues like.",
    );
    // The Qloo line is a sentence of its own, after what Undercard does.
    expect(what).not.toMatch(/Qloo/);
    expect(rest.at(-1)).toBe(
      "Qloo is a taste-data service: it maps what fans of one artist, venue or film also like.",
    );
  });
});
