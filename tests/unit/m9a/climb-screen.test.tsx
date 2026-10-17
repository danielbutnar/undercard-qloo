// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function liveEvents() {
  const server = syntheticServer();
  const events = await readEvents(server.build({ fresh: true }));
  const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
  return { events, saved };
}

function stream(events: unknown[]) {
  return vi.fn(
    async () =>
      new Response(
        events.map((event) => JSON.stringify(event)).join("\n") + "\n",
        {
          headers: { "content-type": "application/x-ndjson" },
        },
      ),
  );
}

describe("the lift, visible, on the screen (M9a)", () => {
  it("plays each venue's re-sort with the real move, then the lineup prints; Skip goes straight there", async () => {
    const { events, saved } = await liveEvents();
    vi.stubGlobal(
      "fetch",
      stream(
        events.map((e) => (e.type === "build" ? { ...e, replayed: true } : e)),
      ),
    );
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{
          build: { id: saved.id, createdAt: saved.createdAt },
          acts: saved.lineup.acts,
          calls: saved.trace.length,
          placesListed: null,
          anchors: {},
          baselineTop: {},
        }}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Watch how it picked these acts",
      })[0],
    );
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    await waitFor(() =>
      expect(
        within(bill).getByText(
          /How the town's venue crowds move acts up Qloo's list/,
        ),
      ).toBeTruthy(),
    );
    // The bands' tiers, and their acts, wait while the climb plays.
    expect(within(bill).queryAllByRole("article")).toHaveLength(0);
    await waitFor(
      () =>
        expect(
          within(bill).getAllByText(/^\+\d+, The Lantern Room$/).length,
        ).toBeGreaterThan(0),
      { timeout: 8000 },
    );
    fireEvent.click(
      within(bill).getByRole("button", { name: "Skip to the lineup" }),
    );
    expect(
      within(bill).queryByText(/How the town's venue crowds move acts/),
    ).toBeNull();
    expect(within(bill).getAllByRole("article")).toHaveLength(10);
  }, 15000);

  it("shows the end state at once under reduced motion", async () => {
    const { events, saved } = await liveEvents();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal("fetch", stream(events));
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{
          build: { id: saved.id, createdAt: saved.createdAt },
          acts: saved.lineup.acts,
          calls: saved.trace.length,
          placesListed: null,
          anchors: {},
          baselineTop: {},
        }}
      />,
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Watch how it picked these acts",
      })[0],
    );
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    await waitFor(() =>
      expect(
        within(bill).getAllByText(/^Re-ranked with the fans of /).length,
      ).toBe(2),
    );
  });
});

describe("the venues rail during the climb", () => {
  it("steps aside, so it never shows zero lifts beside a climb that shows them", async () => {
    const { events, saved } = await liveEvents();
    vi.stubGlobal("fetch", stream(events));
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{
          build: { id: saved.id, createdAt: saved.createdAt },
          acts: saved.lineup.acts,
          calls: saved.trace.length,
          placesListed: null,
          anchors: saved.context.anchors,
          baselineTop: {},
        }}
      />,
    );
    expect(screen.getByRole("region", { name: /venues whose fans shaped this lineup/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Watch how it picked these acts" })[0]);
    await waitFor(() =>
      expect(screen.getByText(/How the town's venue crowds move acts up/)).toBeTruthy(),
    );
    expect(screen.queryByRole("region", { name: /venues whose fans shaped this lineup/ })).toBeNull();
  });
});
