// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const WATCH = { name: "Watch the AI agent build it" };
const open = () =>
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);
// The button after the lead is the only one, at every width
// (tests/unit/m9d/watch-under-headliners.test.tsx checks where it sits).
describe("Watch the AI agent build it after the lead", () => {
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
    fireEvent.click(screen.getByRole("button", WATCH));
    expect(fetch).toHaveBeenCalledWith(
      "/api/undercard",
      expect.objectContaining({
        body: JSON.stringify({ fresh: false, festival: "sagebrush-sound" }),
      }),
    );
    // Watch plays at once: its button turns into Skip, and the caption opens.
    expect(
      (
        screen.getByRole("button", {
          name: "Skip to the lineup",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(screen.getByText("Replaying the AI agent's build")).toBeTruthy();
  });
});
