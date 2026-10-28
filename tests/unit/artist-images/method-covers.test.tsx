// @vitest-environment jsdom
// How it works shows each act's Qloo image where the first screen does (Daniel, 2026-10-21):
// the walkthrough's row at every step, its lineup and Try it. Invented image URLs.
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
  window.history.replaceState(null, "", "/");
});

const image = (n: number) => `https://images.qloo.com/i/synthetic-${n}.jpg`;
const IMAGES = Object.fromEntries(
  acts.map((act, n) => [act.entityId, image(n)]),
);
const PLACES = {
  [acts[0].entityId]: { now: 3, was: 14 },
  [acts[1].entityId]: { now: 6, was: 13 },
  [acts[2].entityId]: { now: 2, was: 28 },
  [acts[3].entityId]: { now: 9, was: 18 },
};

function page(images?: Record<string, string>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/venue-switch")
        ? Response.json(syntheticVenueSwitch())
        : new Response(null, { status: 404 }),
    ),
  );
  const story = methodStory(SAGEBRUSH_SOUND, {
    ...FIRST_BILL,
    places: PLACES,
    ...(images ? { images } : {}),
  })!;
  render(<MethodPage story={story} videoUrl={null} />);
}

const region = (name: string | RegExp) =>
  screen.getByRole("region", { name });
const photoOf = (row: HTMLElement) =>
  row.querySelector("img.cover-photo")?.getAttribute("src") ?? null;
describe("an act's photo on How it works", () => {
  it("carries the saved build's images into the story", () => {
    const story = methodStory(SAGEBRUSH_SOUND, {
      ...FIRST_BILL,
      images: IMAGES,
    })!;
    expect(story.images).toEqual(IMAGES);
  });

  // Since WS12 item 2: the act's strip in scenes 1 and 2, and its ticket at the door (scene 3).
  it("is on the followed act's strip in the scenes it climbs in, and on its ticket", () => {
    page(IMAGES);
    for (const n of [1, 2]) {
      const strip = within(
        within(region(new RegExp(`^Scene ${n}: `))).getByRole("list", {
          name: /^Qloo's ranking/,
        }),
      )
        .getAllByRole("listitem")
        .find((row) => row.textContent?.includes(acts[0].name))!;
      expect(photoOf(strip)).toBe(image(0));
    }
    expect(
      photoOf(
        within(region(/^Scene 3: /)).getByRole("article", {
          name: `${acts[0].name}'s ticket`,
        }),
      ),
    ).toBe(image(0));
  });

  it("is the drawn cover when the build has no images", () => {
    page();
    expect(document.querySelector("img.cover-photo")).toBeNull();
  });
});
