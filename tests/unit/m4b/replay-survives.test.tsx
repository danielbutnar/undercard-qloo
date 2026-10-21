// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Activity } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syntheticBuildStream } from "../../e2e/synthetic-build";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "./first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Next.js can run a component's effect cleanups without unmounting it (a hidden Activity, a
// Fast Refresh). A replay in flight must survive that, or the board sticks on "Building…".
describe("a replay in flight", () => {
  it("still lands when the screen's effects are cleaned up and set up again", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        // The venue switch reads the saved build's results on mount; it isn't the replay.
        if (url.startsWith("/api/venue-switch"))
          return new Response(null, { status: 404 });
        await gate;
        if (init?.signal?.aborted)
          throw new DOMException("The request was aborted.", "AbortError");
        return new Response(syntheticBuildStream({ replayed: true }), {
          headers: { "content-type": "application/x-ndjson" },
        });
      }),
    );
    const screenIn = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />
      </Activity>
    );
    const { rerender } = render(screenIn("visible"));
    // Watch sits in the lead beside the chart, not inside the draft.
    fireEvent.click(
      screen.getByRole("button", { name: "Watch how it picked these acts" }),
    );
    rerender(screenIn("hidden"));
    rerender(screenIn("visible"));
    release();

    await waitFor(() =>
      expect(screen.getByText(/^Replayed the build saved/)).toBeTruthy(),
    );
    // Watch hands the chart back a beat after the build is in; then the lineup returns.
    await waitFor(() =>
      expect(screen.getAllByRole("article")).toHaveLength(10),
    );
    // Watch is ready to play again: the screen isn't stuck on "Building…" or "Watching…".
    expect(
      screen.getByRole("button", { name: "Watch how it picked these acts" }),
    ).toHaveProperty("disabled", false);
  });
});
