// @vitest-environment jsdom
// Plan.md item 7 (the review's I1 and Q2): the positioning and the principle, in Daniel's words,
// on the home page (in place of words already there) and on How it works.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodPage } from "@/components/method-page";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const SHORTLIST =
  "drafts a shortlist with its evidence attached; the buyer makes every call";
const PRINCIPLE = "Qloo decides, the model plans, the rule books.";
const quiet = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );

describe("the positioning, in Daniel's words (plan.md item 7)", () => {
  it("is on the home page, in place of words that were there", () => {
    quiet();
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    const text = document.body.textContent ?? "";
    // Since WS12 item 1 (plan-to-9) the home page ends on the positioning's short form, in place
    // of How an act gets on's two lines; How it works keeps the principle.
    expect(text).toContain("Undercard drafts. The buyer makes every call.");
    expect(text).not.toContain(
      "the acts that play before the headliners from what fans",
    );
    expect(text).not.toContain(
      "Qloo supplies the numbers; the AI agent picks which venues to read.",
    );
  });

  it("is on How it works", () => {
    quiet();
    render(
      <MethodPage
        story={methodStory(SAGEBRUSH_SOUND, FIRST_BILL)!}
        videoUrl={null}
      />,
    );
    const text = document.body.textContent ?? "";
    expect(text).toContain(`Undercard ${SHORTLIST}.`);
    expect(
      screen.getByRole("region", { name: "Who does what" }).textContent,
    ).toContain(PRINCIPLE);
  });
});
