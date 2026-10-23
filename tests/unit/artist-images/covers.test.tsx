// @vitest-environment jsdom
// Artist images (item 4 of Daniel's brief of 2026-10-21) on WS9's first screen: each headliner's
// photo on the poster, and each act's on its card; the drawn cover where there is none or it
// doesn't load. Invented image URLs.
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
const HEADLINERS = SAGEBRUSH_SOUND.headliners.map((name, n) => ({
  entityId: `00000000-0000-4000-8000-00000000000${n + 1}`,
  name,
}));
const HEADLINER_IMAGES = Object.fromEntries(
  HEADLINERS.map((headliner, n) => [headliner.entityId, image(90 + n)]),
);
const WITH_PHOTOS = {
  ...FIRST_BILL,
  images: IMAGES,
  headliners: HEADLINERS,
  headlinerImages: HEADLINER_IMAGES,
};
const first = acts[0];
const act = () => screen.getByRole("article", { name: first.name });
const card = () => screen.getByRole("region", { name: "Act card" });
const headliners = () =>
  screen.getByRole("list", { name: "Booked headliners" });

describe("the first screen's photos", () => {
  it("are Qloo's: each headliner's on the poster, and each act's on its card", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={WITH_PHOTOS} />,
    );
    const photos = headliners().querySelectorAll("img.cover-photo");
    expect([...photos].map((photo) => photo.getAttribute("src"))).toEqual([
      image(90),
      image(91),
    ]);
    // Decorative beside each name, which names the headliner itself.
    expect(photos[0].getAttribute("alt")).toBe("Photo of Khruangbin");
    expect(photos[0].getAttribute("aria-hidden")).toBe("true");
    expect(
      within(headliners())
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(SAGEBRUSH_SOUND.headliners);
    // The poster sets each act as a name in its venue's colour; its photo is on its card.
    expect(act().querySelector("img")).toBeNull();
    fireEvent.click(within(act()).getByRole("button", { name: first.name }));
    expect(
      within(card())
        .getByRole("img", { name: `Photo of ${first.name}` })
        .getAttribute("src"),
    ).toBe(image(0));
    // Credited once, wherever they show.
    expect(screen.getAllByText("Artist images via Qloo")).toHaveLength(1);
  });

  it("fall back to the drawn cover when a photo doesn't load", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={WITH_PHOTOS} />,
    );
    fireEvent.error(headliners().querySelector("img.cover-photo")!);
    expect(headliners().querySelectorAll("img.cover-photo")).toHaveLength(1);
    expect(headliners().querySelector("svg.sleeve")).not.toBeNull();
    fireEvent.click(within(act()).getByRole("button", { name: first.name }));
    fireEvent.error(card().querySelector("img.cover-photo")!);
    expect(card().querySelector("img.cover-photo")).toBeNull();
    expect(card().querySelector("svg.sleeve")).not.toBeNull();
  });

  it("are drawn covers when there's no image, as while the setting is off", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(document.querySelector("img.cover-photo")).toBeNull();
    expect(headliners().querySelectorAll("svg.quilt")).toHaveLength(2);
    fireEvent.click(within(act()).getByRole("button", { name: first.name }));
    expect(card().querySelector("svg.sleeve")).not.toBeNull();
    expect(screen.queryByText("Artist images via Qloo")).toBeNull();
  });
});
