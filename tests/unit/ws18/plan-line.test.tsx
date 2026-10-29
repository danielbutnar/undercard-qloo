// @vitest-environment jsdom
// WS18 (Daniel, 29 Oct, 20:40): the agent's plan line, which left the town's note with item 2,
// is "the first line of the setlist, under its heading, in the agent's own words, marked as the
// agent's". It isn't said again further down the setlist. Synthetic data only.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(cleanup);

const saved = syntheticSavedBuild();
// The plan as a 2.0 build saves it: the agent's line on its venues, said after its last read.
// It says "room": the agent's own words, which the setlist's plain words would make "venue".
const PLAN =
  "I read The Lantern Room for both tiers, then Fort Street Ballroom; each room lifted acts over its control.";
const BILL = {
  ...FIRST_BILL,
  trace: saved.trace,
  notes: [...(saved.notes ?? []), { at: 9, text: PLAN }],
  plan: PLAN,
};
const setlist = () =>
  screen.getByRole("region", { name: "The AI agent's setlist" });

describe("the agent's plan line (WS18, Daniel 20:40)", () => {
  it("is the setlist's first line, under its heading, in the agent's own words, marked as the agent's", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={BILL} />);
    const sheet = setlist();
    const heading = within(sheet).getByRole("heading", {
      name: "The AI agent's setlist",
    });
    const plan = within(sheet).getByText(`The AI agent: ${PLAN}`);
    expect(plan.className).toContain("setlist-agent");
    const firstCall = within(sheet).getAllByRole("listitem", {
      name: /^Call \d+/,
    })[0];
    // Under the heading, and before the first call.
    expect(
      heading.compareDocumentPosition(plan) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      plan.compareDocumentPosition(firstCall) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Said once: not again where the agent said it.
    expect(sheet.textContent!.split(PLAN)).toHaveLength(2);
  });

  it("isn't there for a build that has no plan", () => {
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{ ...FIRST_BILL, trace: saved.trace, notes: saved.notes }}
      />,
    );
    expect(setlist().querySelector(".setlist-plan")).toBeNull();
  });
});
