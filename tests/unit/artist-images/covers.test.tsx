// @vitest-environment jsdom
// Artist images on the rows and the card (item 4, built but off): invented image URLs.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(cleanup);

const image = (n: number) => `https://images.qloo.com/i/synthetic-${n}.jpg`;
const IMAGES = Object.fromEntries(
  acts.map((act, n) => [act.entityId, image(n)]),
);
const first = acts[0];
const row = () => screen.getByRole("article", { name: first.name });

describe("an act's cover", () => {
  it("is Qloo's image on its row and its card when the saved build carries one", () => {
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{ ...FIRST_BILL, images: IMAGES }}
      />,
    );
    const photo = row().querySelector("img.cover-photo")!;
    expect(photo.getAttribute("src")).toBe(image(0));
    // Decorative on the row, whose own label names the act.
    expect(photo.getAttribute("aria-hidden")).toBe("true");
    expect(row().querySelector("svg.sleeve")).toBeNull();
    fireEvent.click(within(row()).getByRole("button", { name: first.name }));
    const card = within(screen.getByRole("region", { name: "Act card" }));
    expect(
      card.getByRole("img", { name: first.name }).getAttribute("src"),
    ).toBe(image(0));
  });

  it("falls back to the drawn cover when the image doesn't load", () => {
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{ ...FIRST_BILL, images: IMAGES }}
      />,
    );
    fireEvent.error(row().querySelector("img.cover-photo")!);
    expect(row().querySelector("img.cover-photo")).toBeNull();
    expect(row().querySelector("svg.sleeve")).not.toBeNull();
  });

  it("is the drawn cover when there's no image, as while the setting is off", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(document.querySelector("img.cover-photo")).toBeNull();
    expect(row().querySelector("svg.sleeve")).not.toBeNull();
  });
});
