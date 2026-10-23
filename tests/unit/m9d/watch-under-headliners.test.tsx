// @vitest-environment jsdom
// After M9d (docs/evidence.md section 25), the weekly chart and WS9's first screen ("Your town
// prints your poster"): Watch is one button, right after the lead in reading order and ahead of
// the poster, at every width (a phone shows it under the lead; a laptop's CSS sets it over the
// town); no other panel carries a copy of it. The lead says what Undercard does; the top bar
// says it's an AI agent and what Qloo is, where Qloo is first named.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(cleanup);

const WATCH = { name: "Watch the AI agent build it" };
const open = () =>
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);
const follows = (first: Node, second: Node) =>
  Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

describe("Watch after the lead (section 25, WS9)", () => {
  it("is one button, after the lead and ahead of the poster, shown at every width", () => {
    open();
    expect(screen.getAllByRole("button", WATCH)).toHaveLength(1);
    const lead = screen.getByRole("region", { name: "What Undercard does" });
    const button = screen.getByRole("button", WATCH);
    // jsdom applies no CSS: no ancestor may hide it at some width.
    expect(button.closest("[class*='hidden']")).toBeNull();
    expect(follows(lead, button)).toBe(true);
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    expect(follows(button, bill)).toBe(true);
    expect(
      follows(button, screen.getByRole("region", { name: "Mid-size acts" })),
    ).toBe(true);
    expect(
      within(
        screen.getByRole("complementary", { name: "Qloo calls" }),
      ).queryByRole("button", WATCH),
    ).toBeNull();
  });

  it("says what Undercard does, and the top bar what Qloo is, where it's first named", () => {
    open();
    const lead = screen.getByRole("region", { name: "What Undercard does" });
    const [headline, what] = [...lead.querySelectorAll("p")].map(
      (p) => p.textContent,
    );
    expect(headline).toBe("You booked the headliners.");
    expect(what).toBe(
      "Undercard drafts the rest from what fans of Boise's music venues like.",
    );
    const tagline = within(screen.getByRole("banner")).getByText(
      /^An AI agent/,
    );
    expect(tagline.textContent).toBe(
      "An AI agent for festival bookers, built on Qloo, a taste-data service that maps what fans of one artist, venue or film also like.",
    );
  });
});
