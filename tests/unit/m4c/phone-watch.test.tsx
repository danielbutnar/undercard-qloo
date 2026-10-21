// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const WATCH = { name: "Watch how it picked these acts" };
const open = () =>
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);
const lead = () => screen.getByRole("region", { name: "What Undercard does" });

// The lead's button under the headline is the only one, at every width
// (tests/unit/m9d/watch-under-headliners.test.tsx checks where it sits).
describe("Watch how it picked these acts in the lead", () => {
  it("replays the saved build", () => {
    // The venue switch asks GET /api/venue-switch once on mount (a 404 is fine: it says it
    // isn't available); the build stream never answers.
    const fetch = vi.fn((url: string) =>
      url.startsWith("/api/venue-switch")
        ? Promise.resolve(new Response("", { status: 404 }))
        : new Promise<Response>(() => {}),
    );
    vi.stubGlobal("fetch", fetch);
    open();
    expect(screen.getAllByRole("button", WATCH)).toHaveLength(1);
    fireEvent.click(within(lead()).getByRole("button", WATCH));
    expect(fetch).toHaveBeenCalledWith(
      "/api/undercard",
      expect.objectContaining({
        body: JSON.stringify({ fresh: false, festival: "sagebrush-sound" }),
      }),
    );
    // Watch plays at once: the button says so and waits, and the edition banner opens.
    expect(
      (
        within(lead()).getByRole("button", {
          name: "Watching…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText("Replaying the AI agent's build")).toBeTruthy();
  });
});
