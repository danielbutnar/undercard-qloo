// @vitest-environment jsdom
// Daniel's third brief of 2026-10-21: a small "Artist images via Qloo" credit where the photos
// appear, and on How it works; none where no photo shows. Invented image URLs.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodPage } from "@/components/method-page";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const CREDIT = "Artist images via Qloo";
const IMAGES = Object.fromEntries(
  acts.map((act, n) => [
    act.entityId,
    `https://images.qloo.com/i/synthetic-${n}.jpg`,
  ]),
);

function quiet() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
}

describe("the credit for Qloo's artist images", () => {
  it("sits with the lineup when its acts have photos", () => {
    quiet();
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{ ...FIRST_BILL, images: IMAGES }}
      />,
    );
    expect(screen.getAllByText(CREDIT)).toHaveLength(1);
  });

  it("isn't there when no act has a photo", () => {
    quiet();
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(screen.queryByText(CREDIT)).toBeNull();
  });

  it("is on How it works when its acts have photos", () => {
    quiet();
    const story = methodStory(SAGEBRUSH_SOUND, {
      ...FIRST_BILL,
      images: IMAGES,
    })!;
    render(<MethodPage story={story} videoUrl={null} />);
    expect(screen.getAllByText(CREDIT)).toHaveLength(1);
  });
});
