// @vitest-environment jsdom
// WS9's motion (the layout brief's play()): on a laptop, as Watch reads a venue, each act its
// fans lifted flies from the venue to its slot on the poster as a small card (its photo or drawn
// cover, its name and its climb), and stamps in as it lands; with the Web Animations API only.
// On a phone, and under reduced motion, nothing flies: the acts land in place.
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
// loaded machine can't fail them: Watch's pace runs on it, and a card is checked on the venue's
// own step, never a later one. requestAnimationFrame and performance.now stay real: the flights
// use the Web Animations API (stubbed below), and the page's one frame-paced motion, the town's
// camera glide, needs a measured viewport that jsdom never gives, so no frame is asked for here.
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (Element.prototype as { animate?: unknown }).animate;
});

const WATCH = { name: "Watch the AI agent build it" };

async function watchOn({
  wide,
  reduced = false,
  latency = 0,
}: {
  wide: boolean;
  reduced?: boolean;
  latency?: number;
}) {
  const server = syntheticServer();
  const events = await readEvents(server.build({ fresh: true }));
  const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches:
      (wide && query.includes("min-width: 1100px")) ||
      (reduced && query.includes("reduce")),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  const animate = vi.fn(() => ({
    finished: Promise.resolve(),
    cancel() {},
    onfinish: null,
  }));
  Object.defineProperty(Element.prototype, "animate", {
    value: animate,
    configurable: true,
    writable: true,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      await lag(latency);
      return url.startsWith("/api/venue-switch")
        ? new Response("{}", { status: 404 })
        : new Response(
            events
              .map((e) => (e.type === "build" ? { ...e, replayed: true } : e))
              .map((event) => JSON.stringify(event))
              .join("\n") + "\n",
            { headers: { "content-type": "application/x-ndjson" } },
          );
    }),
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
  const mid = within(
    screen.getByRole("region", { name: "Undercard draft" }),
  ).getByRole("region", { name: "Mid-size acts" });
  await settle(() =>
    expect(
      within(mid).queryAllByText("With The Lantern Room's fans added"),
    ).toHaveLength(1),
  );
  const lantern = saved.lineup.acts.filter(
    (act) => act.band === "mid" && act.anchorVenue.name === "The Lantern Room",
  );
  return { animate, lantern, mid };
}

describe.each([
  { speed: "at full speed", latency: 0 },
  { speed: "on a slow machine", latency: SLOW_MS },
])("Watch's acts on a laptop, $speed", ({ latency }) => {
  it("fly from the venue to their slots, each a card with its name and climb, then stamp in", async () => {
    const { animate, lantern, mid } = await watchOn({ wide: true, latency });
    const cards = [...document.querySelectorAll(".fly-card")];
    expect(
      cards.map((card) => card.querySelector(".fly-name")!.textContent).sort(),
    ).toEqual(lantern.map((act) => act.name).sort());
    for (const card of cards) {
      expect(card.closest("[aria-hidden='true']")).not.toBeNull();
      const act = lantern.find(
        (entry) => entry.name === card.querySelector(".fly-name")!.textContent,
      )!;
      const lift = liftOf(act)!;
      expect(card.querySelector(".fly-climb")!.textContent).toBe(
        lift.kind === "up" ? `↑${lift.places}` : "NEW",
      );
      // A photo or its drawn cover, never an empty box.
      expect(card.querySelector("img.cover-photo, svg.sleeve")).not.toBeNull();
    }
    // One flight per card, with the Web Animations API.
    expect(animate).toHaveBeenCalledTimes(cards.length);
    // Each act's slot waits for its card: it stamps in as the card lands, one after another.
    const delays = lantern.map((act) =>
      parseFloat(
        within(mid).getByRole("article", { name: act.name }).style
          .animationDelay,
      ),
    );
    for (const delay of delays) expect(delay).toBeGreaterThan(0.5);
    expect(new Set(delays).size).toBe(delays.length);
  });
});

describe.each([
  { speed: "at full speed", latency: 0 },
  { speed: "on a slow machine", latency: SLOW_MS },
])("Watch's acts land in place, $speed", ({ latency }) => {
  it("on a phone, with no card flying", async () => {
    const { animate } = await watchOn({ wide: false, latency });
    expect(document.querySelectorAll(".fly-card")).toHaveLength(0);
    expect(animate).not.toHaveBeenCalled();
  });

  it("under reduced motion, on a laptop too", async () => {
    const { animate, lantern, mid } = await watchOn({
      wide: true,
      reduced: true,
      latency,
    });
    expect(document.querySelectorAll(".fly-card")).toHaveLength(0);
    expect(animate).not.toHaveBeenCalled();
    expect(within(mid).getAllByRole("article")).toHaveLength(lantern.length);
  });
});
