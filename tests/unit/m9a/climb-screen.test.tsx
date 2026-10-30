// @vitest-environment jsdom
// The lift, visible (M9a), on WS9's first screen: Watch reads each venue in turn and the acts its
// fans lifted land on the poster in their slots, each with its real climb, while the others wait;
// the caption says whose fans were added and how many acts climb onto the lineup.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { liftOf } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { readEvents, syntheticServer } from "../m3/scripted";
import { lag, settle, SLOW_MS } from "../test-clock";

// The tests read a clock they move themselves, never the wall clock (Daniel, 2026-10-28), so a
// loaded machine can't fail them: Watch's pace runs on it, and each step is checked on its own
// step. requestAnimationFrame and performance.now stay real: the screen's one frame-paced motion,
// the town's camera glide, needs a measured viewport that jsdom never gives.
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function liveEvents() {
  const server = syntheticServer();
  const events = await readEvents(server.build({ fresh: true }));
  const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
  return { events, saved };
}

// The venue switch asks GET /api/venue-switch once on mount; a 404 makes it say it isn't
// available. Every other request is the build's stream. On a slow machine each answer arrives
// `latency` after its request.
function stream(events: unknown[], latency = 0) {
  return vi.fn(async (url: string) => {
    await lag(latency);
    return url.startsWith("/api/venue-switch")
      ? new Response("{}", { status: 404 })
      : new Response(
          events.map((event) => JSON.stringify(event)).join("\n") + "\n",
          {
            headers: { "content-type": "application/x-ndjson" },
          },
        );
  });
}

const SPEEDS = [
  { speed: "at full speed", latency: 0 },
  { speed: "on a slow machine", latency: SLOW_MS },
];

const WATCH = { name: "Watch the AI agent build it" };
const SKIP = { name: "Skip to the lineup" };

type Saved = Awaited<ReturnType<typeof liveEvents>>["saved"];
const firstBill = (saved: Saved) => ({
  build: { id: saved.id, createdAt: saved.createdAt },
  acts: saved.lineup.acts,
  calls: saved.trace.length,
  placesListed: null,
  anchors: {},
  baselineTop: {},
});
const liftedBy = (saved: Saved, venue: string) =>
  saved.lineup.acts.filter(
    (act) => act.band === "mid" && act.anchorVenue.name === venue,
  );

describe.each(SPEEDS)(
  "the lift, visible, on the screen (M9a), $speed",
  ({ latency }) => {
    it("lands each venue's acts on the poster with their real climb, then the lineup prints; Skip goes straight there", async () => {
      const { events, saved } = await liveEvents();
      vi.stubGlobal(
        "fetch",
        stream(
          events.map((e) =>
            e.type === "build" ? { ...e, replayed: true } : e,
          ),
          latency,
        ),
      );
      render(
        <FestivalScreen
          festival={SAGEBRUSH_SOUND}
          firstBill={firstBill(saved)}
        />,
      );
      fireEvent.click(screen.getByRole("button", WATCH));
      const bill = screen.getByRole("region", { name: "Undercard draft" });
      // Watch opens on the replay, its own button turned into Skip; the acts wait while it plays.
      expect(
        within(bill).getByText("Replaying the AI agent's build"),
      ).toBeTruthy();
      expect(screen.getByRole("button", SKIP)).toBeTruthy();
      expect(within(bill).queryAllByRole("article")).toHaveLength(0);
      // First the headliners' fans alone...
      await settle(() =>
        expect(
          within(bill).queryAllByText(
            "Khruangbin + Japanese Breakfast fans alone",
          ),
        ).toHaveLength(1),
      );
      expect(within(bill).queryAllByRole("article")).toHaveLength(0);
      // ...then The Lantern Room's fans added for the mid-size acts: the acts its fans lifted land
      // in their slots, each with its real climb, and the others still wait.
      const mid = within(bill).getByRole("region", { name: "Mid-size acts" });
      await settle(() =>
        expect(
          within(mid).queryAllByText("With The Lantern Room's fans added"),
        ).toHaveLength(1),
      );
      expect(within(bill).getByText("+ The Lantern Room's fans")).toBeTruthy();
      const lantern = liftedBy(saved, "The Lantern Room");
      expect(lantern.length).toBeGreaterThan(0);
      expect(
        within(bill).getByText(
          `Qloo's ranking re-sorts with this venue's fans added: ${lantern.length} ${lantern.length === 1 ? "act climbs" : "acts climb"} onto the lineup.`,
        ),
      ).toBeTruthy();
      const landed = within(mid).getAllByRole("article");
      expect(
        landed.map((article) => article.getAttribute("aria-label")).sort(),
      ).toEqual(lantern.map((act) => act.name).sort());
      for (const act of lantern) {
        const lift = liftOf(act)!;
        const article = within(mid).getByRole("article", { name: act.name });
        expect(article.querySelector(".poster-climb")!.textContent).toBe(
          lift.kind === "up" ? `↑${lift.places}` : "NEW",
        );
        // It stamps in as it lands.
        expect(article.className).toContain("animate-print-in");
        expect(parseFloat(article.style.animationDelay)).toBe(0);
      }
      const waiting = saved.lineup.acts.filter(
        (act) => act.band === "mid" && !lantern.includes(act),
      );
      expect(within(mid).getAllByText("Open slot")).toHaveLength(
        waiting.length,
      );
      // Skip goes straight to the lineup: the acts still waiting print in, down the poster.
      fireEvent.click(screen.getByRole("button", SKIP));
      expect(screen.queryByRole("button", SKIP)).toBeNull();
      expect(screen.getByRole("button", WATCH)).toBeTruthy();
      expect(within(bill).queryByText("+ The Lantern Room's fans")).toBeNull();
      const articles = within(bill).getAllByRole("article");
      expect(articles).toHaveLength(10);
      for (const article of articles)
        expect(article.className).toContain("animate-print-in");
      const delays = articles.map((article) =>
        parseFloat(article.style.animationDelay),
      );
      for (const delay of delays) expect((delay / 0.12) % 1).toBeCloseTo(0, 5);
      expect(new Set(delays).size).toBeGreaterThan(1);
    });

    it("steps through each venue without animation under reduced motion", async () => {
      const { events, saved } = await liveEvents();
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query.includes("reduce"),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }));
      vi.stubGlobal("fetch", stream(events, latency));
      // jsdom has no Web Animations; anything that glided would call this.
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
            firstBill={firstBill(saved)}
          />,
        );
        fireEvent.click(screen.getByRole("button", WATCH));
        const bill = screen.getByRole("region", { name: "Undercard draft" });
        // The steps still come one at a time, at Watch's pace, with Skip there throughout...
        await settle(() =>
          expect(
            within(bill).queryAllByText(
              "Khruangbin + Japanese Breakfast fans alone",
            ),
          ).toHaveLength(1),
        );
        expect(screen.getByRole("button", SKIP)).toBeTruthy();
        const mid = within(bill).getByRole("region", { name: "Mid-size acts" });
        await settle(() =>
          expect(
            within(mid).queryAllByText("With The Lantern Room's fans added"),
          ).toHaveLength(1),
        );
        // ...each venue's acts appear at once, and nothing moves.
        expect(within(mid).getAllByRole("article")).toHaveLength(
          liftedBy(saved, "The Lantern Room").length,
        );
        expect(bill.querySelector("[class*='animate-print-in']")).toBeNull();
        expect(animate).not.toHaveBeenCalled();
        // The lineup comes back without printing in.
        fireEvent.click(screen.getByRole("button", SKIP));
        expect(within(bill).getAllByRole("article")).toHaveLength(10);
        expect(bill.querySelector("[class*='animate-print-in']")).toBeNull();
        expect(animate).not.toHaveBeenCalled();
      } finally {
        delete (Element.prototype as { animate?: unknown }).animate;
      }
    });
  },
);

describe.each(SPEEDS)(
  "the venue switch during Watch, $speed",
  ({ latency }) => {
    it("the switch's words step aside while Watch plays, and come back with the lineup", async () => {
      const { events, saved } = await liveEvents();
      vi.stubGlobal("fetch", stream(events, latency));
      render(
        <FestivalScreen
          festival={SAGEBRUSH_SOUND}
          firstBill={{ ...firstBill(saved), anchors: saved.context.anchors }}
        />,
      );
      // Since WS12 item 1 the switch is the poster's key; its sentence sits under it.
      const venueSwitch = () =>
        screen.queryByText(/^These venues' fans are the signal/);
      expect(venueSwitch()).toBeTruthy();
      fireEvent.click(screen.getByRole("button", WATCH));
      await settle(() =>
        expect(
          screen.queryAllByText("Khruangbin + Japanese Breakfast fans alone"),
        ).toHaveLength(1),
      );
      expect(venueSwitch()).toBeNull();
      // It comes back with the lineup.
      fireEvent.click(screen.getByRole("button", SKIP));
      expect(venueSwitch()).toBeTruthy();
    });
  },
);
