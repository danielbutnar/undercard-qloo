// @vitest-environment jsdom
// M10b: How it works, rebuilt (docs/evidence.md section 28), on the synthetic lineup.
import {
  cleanup,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MethodPage } from "@/components/method-page";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { syntheticVenueSwitch } from "../../e2e/synthetic-build";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // A step's link stays in the address between tests (/method?step=N).
  window.history.replaceState(null, "", "/");
});

const PLACES = {
  [acts[0].entityId]: { now: 3, was: 14 }, // Hollow Pines, up 11
  [acts[1].entityId]: { now: 6, was: 13 }, // Marisol Vey, up 7
  [acts[2].entityId]: { now: 2, was: 28 }, // The Ditch Riders, up 26
  [acts[3].entityId]: { now: 9, was: 18 }, // Kestrel & Bloom, up 9
};
const story = methodStory(SAGEBRUSH_SOUND, { ...FIRST_BILL, places: PLACES })!;

// The venue switch reads the saved build's results on mount; the synthetic switch drops a
// venue's acts when it's off.
function page() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/venue-switch")
        ? Response.json(syntheticVenueSwitch())
        : new Response(null, { status: 404 }),
    ),
  );
  render(<MethodPage story={story} videoUrl={null} />);
}


// Since WS12 item 2 How it works is the director's cut of Watch: its scenes, passes and stamps
// are tested in tests/unit/ws12/how-it-works.test.tsx. What M10b decided and still stands here:
// the AI agent's choices, now in the scene where the act's venue is read (scene 2).
describe("How it works (M10b), as the director's cut keeps it", () => {
  it("shows the AI agent's choices in scene 2: the venues it read and the one whose fans lifted no act", () => {
    page();
    const choices = within(
      screen.getByRole("region", { name: /^Scene 2: / }),
    ).getByRole("region", { name: "The AI agent's choices" });
    expect(choices.textContent).toMatch(/Qloo listed 8 live-music places/);
    const venues = within(choices).getAllByRole("listitem");
    expect(venues.map((venue) => venue.textContent)).toEqual([
      "The Lantern Room7 acts lifted",
      "Fort Street Ballroom3 acts lifted",
      "Cottonwood Social Halllifted none",
    ]);
  });
});
