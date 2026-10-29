// @vitest-environment jsdom
// Review fix: a step of How it works has its own link. Since WS12 item 2 the steps are the
// director's cut's four scenes, each with an id (/method#scene-N), and an old /method?step=N
// link still lands on its scene.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MethodPage } from "@/components/method-page";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

const story = methodStory(SAGEBRUSH_SOUND, FIRST_BILL)!;

function open(url: string) {
  window.history.replaceState(null, "", url);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  const scrolled: string[] = [];
  // jsdom has no scrollIntoView: a stand-in records which element was brought into view.
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.id);
  };
  render(<MethodPage story={story} videoUrl={null} />);
  return scrolled;
}

describe("How it works' steps, linkable (review fix, WS12 item 2)", () => {
  it("gives each scene its own anchor, /method#scene-N", () => {
    open("/method");
    expect(
      [1, 2, 3, 4].map((n) => document.getElementById(`scene-${n}`)?.tagName),
    ).toEqual(["SECTION", "SECTION", "SECTION", "SECTION"]);
  });

  it("lands an old /method?step=N link on its scene", () => {
    expect(open("/method?step=3")).toContain("scene-3");
  });

  it("stays at the top when the link names no step it has", () => {
    expect(open("/method?step=9")).not.toContain("scene-9");
    expect(open("/method")).toEqual([]);
  });
});
