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
      vi.fn(async (_url: string, init: RequestInit) => {
        await gate;
        if (init.signal?.aborted)
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
    fireEvent.click(
      screen.getByRole("button", { name: "Watch the agent build it" }),
    );
    rerender(screenIn("hidden"));
    rerender(screenIn("visible"));
    release();

    await waitFor(() =>
      expect(screen.getByText(/^Replayed the build saved/)).toBeTruthy(),
    );
    expect(screen.getAllByRole("article")).toHaveLength(10);
  });
});
