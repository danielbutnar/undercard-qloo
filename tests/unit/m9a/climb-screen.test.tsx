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
import type { ClimbEvent } from "@/lib/lift-climb";
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

// The venue switch asks GET /api/venue-switch once on mount; a 404 makes it say it isn't
// available. Every other request is the build's stream.
function stream(events: unknown[]) {
  return vi.fn(async (url: string) =>
    url.startsWith("/api/venue-switch")
      ? new Response("{}", { status: 404 })
      : new Response(
          events.map((event) => JSON.stringify(event)).join("\n") + "\n",
          {
            headers: { "content-type": "application/x-ndjson" },
          },
        ),
  );
}

// A row's words as they're seen: without the ones kept for screen readers.
const seen = (node: Node) => {
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".sr-only").forEach((child) => child.remove());
  return clone.textContent ?? "";
};

const WATCH = { name: "Watch how it picked these acts" };
const SKIP = { name: "Skip to the lineup" };

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
    fireEvent.click(screen.getByRole("button", WATCH));
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    // Watch opens on the replay, with Skip always there; the bands' acts wait while it plays.
    expect(
      within(bill).getByText("Replaying the AI agent's build"),
    ).toBeTruthy();
    expect(within(bill).getByRole("button", SKIP)).toBeTruthy();
    expect(within(bill).queryAllByRole("article")).toHaveLength(0);
    // First the headliners' fans alone...
    await waitFor(
      () =>
        expect(
          within(bill).getByText("Khruangbin + Japanese Breakfast fans alone"),
        ).toBeTruthy(),
      { timeout: 8000 },
    );
    // ...then the Lantern Room's fans added: its edition of the Mid-size chart, with every
    // act's real move and the place it came from.
    const mid = within(bill).getByRole("region", { name: "Mid-size acts" });
    await waitFor(
      () =>
        expect(
          within(mid).getByText("With The Lantern Room's fans added"),
        ).toBeTruthy(),
      { timeout: 8000 },
    );
    expect(within(bill).getByText("+ The Lantern Room's fans")).toBeTruthy();
    expect(within(bill).queryAllByRole("article")).toHaveLength(0);
    const edition = events
      .filter((e): e is ClimbEvent => e.type === "climb")
      .find(
        (step) =>
          step.band === "mid" && step.venue?.name === "The Lantern Room",
      )!;
    const lifted = edition.acts.filter((listed) => listed.move !== null);
    expect(lifted.length).toBeGreaterThan(0);
    edition.acts.forEach((listed, index) => {
      const row = within(mid).getByText(listed.name).closest("li")!;
      const words = seen(row);
      if (listed.move === null) {
        expect(words).not.toMatch(/\+\d/);
        return;
      }
      const [, move, was] = /\+(\d+)\s*was (\d+)(?:st|nd|rd|th)/.exec(words)!;
      expect(Number(move)).toBe(listed.move);
      expect(Number(was)).toBe(index + 1 + listed.move);
      expect(words).toContain("The Lantern Room");
    });
    // The acts this venue's fans put on the lineup say so, and only they do.
    const booked = saved.lineup.acts
      .filter(
        (act) =>
          act.band === "mid" && act.anchorVenue.name === "The Lantern Room",
      )
      .map((act) => act.name);
    expect(booked.length).toBeGreaterThan(0);
    for (const listed of edition.acts)
      expect(
        seen(within(mid).getByText(listed.name).closest("li")!).includes(
          "On the lineup",
        ),
      ).toBe(booked.includes(listed.name));
    // Skip goes straight to the lineup, which prints in act by act.
    fireEvent.click(within(bill).getByRole("button", SKIP));
    expect(within(bill).queryByRole("button", SKIP)).toBeNull();
    expect(within(bill).queryByText("+ The Lantern Room's fans")).toBeNull();
    const articles = within(bill).getAllByRole("article");
    expect(articles).toHaveLength(10);
    for (const article of articles)
      expect(article.className).toContain("animate-print-in");
    // Each act has its own turn, in steps of 0.12 s down the chart (the two bands' rows side
    // by side), starting at once.
    const delays = articles
      .map((article) => parseFloat(article.style.animationDelay))
      .sort((a, b) => a - b);
    expect(delays[0]).toBe(0);
    expect(new Set(delays).size).toBe(delays.length);
    for (const delay of delays) expect((delay / 0.12) % 1).toBeCloseTo(0, 5);
  }, 15000);

  it("steps through each edition without animation under reduced motion", async () => {
    const { events, saved } = await liveEvents();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal("fetch", stream(events));
    // jsdom has no Web Animations; any row that glided or rose in would call this.
    const animate = vi.fn();
    Object.defineProperty(Element.prototype, "animate", {
      value: animate,
      configurable: true,
      writable: true,
    });
    try {
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
      fireEvent.click(screen.getByRole("button", WATCH));
      const bill = screen.getByRole("region", { name: "Undercard draft" });
      // The editions still come one at a time, at Watch's pace, with Skip there throughout...
      await waitFor(
        () =>
          expect(
            within(bill).getByText(
              "Khruangbin + Japanese Breakfast fans alone",
            ),
          ).toBeTruthy(),
        { timeout: 8000 },
      );
      expect(within(bill).getByRole("button", SKIP)).toBeTruthy();
      const mid = within(bill).getByRole("region", { name: "Mid-size acts" });
      await waitFor(
        () =>
          expect(
            within(mid).getByText("With The Lantern Room's fans added"),
          ).toBeTruthy(),
        { timeout: 8000 },
      );
      expect(bill.querySelector(".row-listed")).toBeTruthy();
      // ...but nothing moves between them.
      expect(animate).not.toHaveBeenCalled();
      // The lineup comes back without printing in.
      fireEvent.click(within(bill).getByRole("button", SKIP));
      expect(within(bill).getAllByRole("article")).toHaveLength(10);
      expect(bill.querySelector("[class*='animate-print-in']")).toBeNull();
      expect(animate).not.toHaveBeenCalled();
    } finally {
      delete (Element.prototype as { animate?: unknown }).animate;
    }
  }, 20000);
});

describe("the venue switch during Watch", () => {
  it("steps aside, so it never shows zero lifts beside editions that show them", async () => {
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
    const venueSwitch = () =>
      screen.queryByRole("region", {
        name: /venues whose fans shaped this lineup/,
      });
    expect(venueSwitch()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", WATCH));
    await waitFor(
      () =>
        expect(
          screen.getByText("Khruangbin + Japanese Breakfast fans alone"),
        ).toBeTruthy(),
      { timeout: 8000 },
    );
    expect(venueSwitch()).toBeNull();
    // It comes back with the lineup.
    fireEvent.click(screen.getByRole("button", SKIP));
    expect(venueSwitch()).toBeTruthy();
  });
});
