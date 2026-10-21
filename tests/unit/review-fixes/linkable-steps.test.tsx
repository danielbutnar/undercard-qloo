// @vitest-environment jsdom
// Item 3 of Daniel's brief of 2026-10-21 (second): each step of How it works' walkthrough has
// its own link, /method?step=N, so stills and the video can open steps 2 to 4 directly.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MethodPage } from "@/components/method-page";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const story = methodStory(SAGEBRUSH_SOUND, FIRST_BILL)!;

function page(url: string) {
  window.history.replaceState(null, "", url);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  render(<MethodPage story={story} videoUrl={null} />);
  return screen.getByRole("region", { name: "Follow one act" });
}

const current = (follow: HTMLElement) =>
  within(follow)
    .getAllByRole("link")
    .find((tab) => tab.getAttribute("aria-current") === "step")!;

describe("the walkthrough's steps, each with its own link", () => {
  it("names each step's link /method?step=N", () => {
    const follow = page("/method");
    expect(
      within(follow)
        .getAllByRole("link")
        .map((tab) => tab.getAttribute("href")),
    ).toEqual([
      "/method?step=1",
      "/method?step=2",
      "/method?step=3",
      "/method?step=4",
    ]);
    expect(current(follow).getAttribute("href")).toBe("/method?step=1");
  });

  it("opens on the step its link names", () => {
    const follow = page("/method?step=3");
    expect(current(follow).getAttribute("href")).toBe("/method?step=3");
    expect(
      within(follow).getByRole("list", { name: "The rule's checks" }),
    ).toBeTruthy();
  });

  it("keeps the address on the step on screen as the reader steps through", () => {
    const follow = page("/method?step=2");
    fireEvent.click(within(follow).getByRole("button", { name: "Next step" }));
    expect(window.location.search).toBe("?step=3");
    fireEvent.click(within(follow).getAllByRole("link")[0]);
    expect(window.location.search).toBe("?step=1");
    expect(current(follow).getAttribute("href")).toBe("/method?step=1");
  });

  it("opens on the first step when the link names no step it has", () => {
    for (const url of [
      "/method?step=0",
      "/method?step=9",
      "/method?step=two",
    ]) {
      const follow = page(url);
      expect(current(follow).getAttribute("href")).toBe("/method?step=1");
      cleanup();
    }
  });
});
