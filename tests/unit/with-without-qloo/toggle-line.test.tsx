// @vitest-environment jsdom
// Plan.md item 8: one line under the With and Without Qloo toggle and on How it works, with the
// counts from evidence section 31, saying only what the record allows.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodPage } from "@/components/method-page";
import counts from "@/data/with-without-qloo.json";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const LINE = `Across ${counts.towns} towns, the model alone and Qloo share no act, and ${counts.picksPassing} of the model's ${counts.picks} picks pass the tests every Qloo act passes.`;
const quiet = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );

describe("the With and Without Qloo line (plan.md item 8)", () => {
  it("sits under the toggle", () => {
    quiet();
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    const toggle = screen.getByRole("group", { name: "Which bill" });
    const line = screen.getByText(LINE);
    expect(
      toggle.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(toggle.parentElement!.contains(line)).toBe(true);
  });

  it("is on How it works, with the evidence", () => {
    quiet();
    render(
      <MethodPage
        story={methodStory(SAGEBRUSH_SOUND, FIRST_BILL)!}
        videoUrl={null}
      />,
    );
    expect(
      within(screen.getByRole("region", { name: "What was tested" })).getByText(
        LINE,
      ),
    ).toBeTruthy();
  });

  it("only says the lineups share no act while the counts say all 10 differ", () => {
    expect(counts.averageChanged).toBe(10);
  });
});
