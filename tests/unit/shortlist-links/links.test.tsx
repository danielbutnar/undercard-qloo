// @vitest-environment jsdom
// Daniel's brief, Phase 3: once the shortlist makes its gate, two links to it below the fold, one
// beside "Draft your own festival" on the first screen and one on How it works.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodPage } from "@/components/method-page";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const quiet = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );

describe("links to the shortlist", () => {
  it("sits beside Draft your own festival under the poster", () => {
    quiet();
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    const link = screen.getByRole("link", {
      name: "Check the acts you've been pitched",
    });
    expect(link.getAttribute("href")).toBe("/shortlist");
    const own = within(screen.getByRole("region", { name: "Undercard draft" })).getByRole("link", { name: /Draft your own festival/ });
    expect(own.parentElement).toBe(link.parentElement);
  });

  it("is on How it works", () => {
    quiet();
    render(
      <MethodPage
        story={methodStory(SAGEBRUSH_SOUND, FIRST_BILL)!}
        videoUrl={null}
      />,
    );
    const link = screen.getByRole("link", {
      name: "Check the acts you've been pitched against a town's venue fans",
    });
    expect(link.getAttribute("href")).toBe("/shortlist");
  });
});
