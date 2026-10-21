// @vitest-environment jsdom
// An act's photo is in the server's HTML, so it can fail to load before React attaches its
// error handler; the drawn cover must still replace it once the page comes alive (found with
// Qloo's image host blocked on a production build, 2026-10-21). Invented image URLs.
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { Cover } from "@/components/chart/cover";

const props = {
  image: "https://images.qloo.com/i/synthetic-0.jpg",
  genres: ["indie rock", "dream pop"],
  id: "synthetic-0",
  name: "An act",
  label: true,
};

afterEach(() => {
  document.body.innerHTML = "";
});

/** The cover as the server sends it, its image already in `state`, then hydrated. */
async function hydrated(state: { complete: boolean; naturalWidth: number }) {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<Cover {...props} />);
  document.body.appendChild(container);
  const img = container.querySelector("img")!;
  Object.defineProperty(img, "complete", { value: state.complete });
  Object.defineProperty(img, "naturalWidth", { value: state.naturalWidth });
  await act(async () => {
    hydrateRoot(container, <Cover {...props} />);
  });
  return container;
}

describe("an act's photo from the server's HTML", () => {
  it("gives way to the drawn cover when it failed before the page came alive", async () => {
    const cover = await hydrated({ complete: true, naturalWidth: 0 });
    expect(cover.querySelector("img")).toBeNull();
    expect(cover.querySelector("svg.sleeve")).not.toBeNull();
  });

  it("stays when it loaded, or is still loading", async () => {
    for (const state of [
      { complete: true, naturalWidth: 320 },
      { complete: false, naturalWidth: 0 },
    ]) {
      const cover = await hydrated(state);
      expect(cover.querySelector("img.cover-photo")).not.toBeNull();
      document.body.innerHTML = "";
    }
  });
});
