// @vitest-environment jsdom
// WS12 item 7: one colour per venue everywhere, grey where a venue's fans lifted no act or Qloo
// had no fan data for it, as the town's signs have it. The poster's key said "0" in a black box
// for a venue Qloo had no fan data for (Venue 166 Boise today); How it works' choices gave
// such a venue a venue colour. Synthetic data: invented acts and venues, no Qloo data.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodPage } from "@/components/method-page";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import {
  COTTONWOOD,
  FIRST_BILL,
  FORT,
  LANTERN,
} from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Cottonwood Social Hall: read for the mid-size tier, no fan data on Qloo, no act lifted.
const BILL = { ...FIRST_BILL, noFanData: [COTTONWOOD.entityId] };

const keyEntry = (name: string) =>
  within(screen.getByRole("group", { name: "Venue fans used for this draft" }))
    .getAllByLabelText(new RegExp(`^${name}`))
    .at(0)!;

describe("the poster's key (WS12 item 7)", () => {
  it("says no fan data, in grey, for a venue Qloo had none for", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={BILL} />);
    const cottonwood = keyEntry(COTTONWOOD.name);
    const count = cottonwood.querySelector(".poster-ink-count")!;
    expect(count.textContent).toBe("no fan data");
    expect(count.className).toContain("is-grey");
    expect(cottonwood.getAttribute("aria-label")).toMatch(
      /^Cottonwood Social Hall's fans: no fan data on Qloo/,
    );
  });

  it("keeps each lifting venue's count in its own box", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={BILL} />);
    for (const [venue, acts] of [
      [LANTERN.name, "7"],
      [FORT.name, "3"],
    ]) {
      const count = keyEntry(venue).querySelector(".poster-ink-count")!;
      expect(count.textContent).toBe(acts);
      expect(count.className).not.toContain("is-grey");
    }
  });

  it("greys the count of a venue whose fans lifted no act", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    const count = keyEntry(COTTONWOOD.name).querySelector(".poster-ink-count")!;
    expect(count.textContent).toBe("0");
    expect(count.className).toContain("is-grey");
  });
});

describe("How it works' choices (WS12 item 7)", () => {
  it("colours only the venues whose fans lifted acts; the rest are grey, as in the town", () => {
    const story = methodStory(SAGEBRUSH_SOUND, BILL)!;
    render(<MethodPage story={story} />);
    const choices = screen.getByRole("region", {
      name: "The AI agent's choices",
    });
    const entry = (name: string) =>
      within(choices).getByText(name).closest("li")!;
    expect(entry(LANTERN.name).className).toMatch(/\bvenue-\d\b/);
    expect(entry(FORT.name).className).toMatch(/\bvenue-\d\b/);
    expect(entry(COTTONWOOD.name).className).not.toMatch(/\bvenue-\d\b/);
  });
});
