// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { roomsBehind } from "@/lib/rooms";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import {
  acts,
  COTTONWOOD,
  FIRST_BILL,
  FORT,
  LANTERN,
} from "./first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the rooms behind the bill", () => {
  it("counts the acts each tested room lifted, most first, with the bands it was tested for", () => {
    expect(roomsBehind(acts, FIRST_BILL.anchors)).toEqual([
      { venue: LANTERN, short: null, bands: ["mid", "opener"], lifted: 7 },
      { venue: FORT, short: "FSB", bands: ["mid", "opener"], lifted: 3 },
      { venue: COTTONWOOD, short: "CSH", bands: ["mid"], lifted: 0 },
    ]);
  });

  it("leaves an unavailable act out of its room's count", () => {
    const [lantern] = roomsBehind(acts, FIRST_BILL.anchors, [acts[0].entityId]);
    expect(lantern.lifted).toBe(6);
  });

  it("lists a room an act names even when the build didn't record it as tested", () => {
    expect(roomsBehind(acts, {}).map((room) => room.venue.name)).toEqual([
      "The Lantern Room",
      "Fort Street Ballroom",
    ]);
  });
});

// The rooms rail became the venue switch beside the chart.
describe("the venue switch beside the lineup", () => {
  const REGION = "Boise venues whose fans shaped this lineup";
  const switcher = () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    return screen.getByRole("region", { name: REGION });
  };
  // The venue switch reads the saved build's results on mount; the replay never answers.
  const stubPendingReplay = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.startsWith("/api/venue-switch")
          ? Promise.resolve(new Response(null, { status: 404 }))
          : new Promise<Response>(() => {}),
      ),
    );

  it("says how many places Qloo listed and how many venues the agent read", () => {
    expect(
      within(switcher()).getByText(
        /^Qloo listed 8 Boise live-music places; the AI agent read the fans of these 3\./,
      ),
    ).toBeTruthy();
  });

  it("says a venue stands for its crowd, not a stage the acts will play", () => {
    expect(
      within(switcher()).getByText(
        /These venues stand for the town's taste: the acts won't necessarily play there\./,
      ),
    ).toBeTruthy();
  });

  it("gives each venue its count of acts lifted, a zero included", () => {
    const region = within(switcher());
    expect(
      region.getAllByRole("listitem").map((venue) => venue.textContent),
    ).toEqual([
      "The Lantern Room7 acts lifted",
      "Fort Street Ballroom3 acts lifted",
      "Cottonwood Social Halllifted none",
    ]);
    // Each is a switch that starts on, and its name carries the same count.
    expect(
      region
        .getAllByRole("button", { pressed: true })
        .map((toggle) => toggle.getAttribute("aria-label")),
    ).toEqual([
      "The Lantern Room: on, 7 acts lifted",
      "Fort Street Ballroom: on, 3 acts lifted",
      "Cottonwood Social Hall: on, lifted none",
    ]);
  });

  it("steps aside while Watch plays so the trace stays in view, and returns after", () => {
    stubPendingReplay();
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(screen.getByRole("region", { name: REGION })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Watch the AI agent build it" }),
    );
    expect(screen.queryByRole("region", { name: REGION })).toBeNull();
    expect(
      screen.getByRole("complementary", { name: "Qloo calls" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the lineup" }));
    expect(
      within(screen.getByRole("region", { name: REGION })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(3);
  });

  it("stays beside the lineup when an act's card opens, because the card opens under its row", () => {
    switcher();
    fireEvent.click(
      within(screen.getByRole("region", { name: "Undercard draft" })).getByRole(
        "button",
        { name: "Hollow Pines" },
      ),
    );
    expect(screen.getByRole("region", { name: "Act card" })).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: REGION })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(3);
  });
});
