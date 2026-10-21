// @vitest-environment jsdom
// Plan.md item 4 (the review's D2): for a saved build, the venue results come with the page, so
// the first paint and a plain fetch show them, not a loading line; the browser doesn't ask for
// them again.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { syntheticVenueSwitch } from "../../e2e/synthetic-build";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the venue results with the page (plan.md item 4)", () => {
  it("shows a saved build's venue results at once, without asking for them", () => {
    const fetch = vi.fn<(url: string) => Promise<Response>>(
      async () => new Response(null, { status: 404 }),
    );
    vi.stubGlobal("fetch", fetch);
    const data = syntheticVenueSwitch();
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{
          ...FIRST_BILL,
          venueSwitch: { ...data, buildId: FIRST_BILL.build.id },
        }}
      />,
    );
    expect(
      screen.queryByText("Loading the saved build's venue results…"),
    ).toBeNull();
    // Ready on first paint: the slot count in place of the loading line, the toggles live.
    expect(screen.getByText(/^\d+ of \d+ slots filled$/)).toBeTruthy();
    const toggles = screen
      .getAllByRole("button")
      .filter((button) => button.className.includes("venue-toggle"));
    expect(toggles.length).toBeGreaterThan(0);
    for (const toggle of toggles)
      expect(toggle.hasAttribute("disabled")).toBe(false);
    expect(
      fetch.mock.calls.filter(([url]) =>
        String(url).startsWith("/api/venue-switch"),
      ),
    ).toHaveLength(0);
  });
});
