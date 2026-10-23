// @vitest-environment jsdom
// Plan.md item 8: one line under the With and Without Qloo toggle and on How it works, with the
// counts from evidence section 31, saying only what the record allows.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { sharedPhrase } from "@/components/chart/with-without-line";
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

// Corrected 2026-10-22: Duluth's two lineups share one act (evidence 31), so the line says so.
const LINE = `Across ${counts.towns} towns, the model alone and Qloo share one act, in one town, and ${counts.picksPassing} of the model's ${counts.picks} picks pass all three checks.`;
const quiet = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );

describe("the With and Without Qloo line (plan.md item 8)", () => {
  it("gives way under the toggle to the per-check line (prompt-4)", () => {
    quiet();
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    const toggle = screen.getByRole("group", { name: "Which bill" });
    expect(screen.queryByText(LINE)).toBeNull();
    const line = screen.getByText(/share two genres with the headliners/);
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

  it("reads the shared acts from the exact count, not the rounded average", () => {
    expect(counts).toMatchObject({ sharedActs: 1, townsSharingAnAct: 1 });
    expect(sharedPhrase({ sharedActs: 0, townsSharingAnAct: 0 })).toBe(
      "the model alone and Qloo share no act",
    );
    expect(sharedPhrase({ sharedActs: 1, townsSharingAnAct: 1 })).toBe(
      "the model alone and Qloo share one act, in one town",
    );
    expect(sharedPhrase({ sharedActs: 3, townsSharingAnAct: 2 })).toBe(
      "the model alone and Qloo share 3 acts, in 2 towns",
    );
  });
});
