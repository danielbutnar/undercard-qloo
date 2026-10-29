// @vitest-environment jsdom
// WS9's motion (the layout brief's play()): on a laptop, as Watch reads a venue, each act its
// fans lifted flies from the venue to its slot on the poster as a small card (its photo or drawn
// cover, its name and its climb), and stamps in as it lands; with the Web Animations API only.
// On a phone, and under reduced motion, nothing flies: the acts land in place.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { liftOf } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createQlooClient } from "@/server/qloo";
import { readVenueSwitch } from "@/server/venue-switch";
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
  holdSwitch = false,
}: {
  wide: boolean;
  reduced?: boolean;
  latency?: number;
  /** The venue switch's answer waits for answerSwitch() (otherwise it finds nothing at once). */
  holdSwitch?: boolean;
}) {
  const server = syntheticServer();
  const events = await readEvents(server.build({ fresh: true }));
  const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
  // The screen's media queries, with their listeners, so a test can resize the window. A laptop
  // starts on the short-laptop side of its line, as every query with min-width 1100px matched.
  let short = true;
  const listeners = new Map<string, Set<() => void>>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches:
      (wide &&
        query.includes("min-width: 1100px") &&
        (short || !query.includes("max-height"))) ||
      (reduced && query.includes("reduce")),
    media: query,
    addEventListener(_type: string, listener: () => void) {
      listeners.set(query, (listeners.get(query) ?? new Set()).add(listener));
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.get(query)?.delete(listener);
    },
  }));
  /** A resize across the short-laptop line (760 px tall, 1250 px wide). */
  const resize = (to: { short: boolean }) => {
    short = to.short;
    for (const [query, set] of listeners)
      if (query.includes("max-height")) for (const listener of set) listener();
  };
  const cancel = vi.fn();
  const animate = vi.fn(() => ({
    finished: Promise.resolve(),
    cancel,
    onfinish: null,
  }));
  Object.defineProperty(Element.prototype, "animate", {
    value: animate,
    configurable: true,
    writable: true,
  });
  // The switch worked out on the server for this build, as GET /api/venue-switch answers it.
  const switchData = holdSwitch
    ? await readVenueSwitch({
        store: server.store,
        festival: SAGEBRUSH_SOUND,
        qloo: createQlooClient({
          apiKey: "k",
          cache: server.cache,
          fetch: () => {
            throw new Error("the venue switch must not call Qloo");
          },
          cacheOnly: true,
        }),
        buildId: saved.id,
      })
    : null;
  let answer: (response: Response) => void = () => {};
  const switchAnswer = new Promise<Response>((resolve) => (answer = resolve));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      await lag(latency);
      if (url.startsWith("/api/venue-switch"))
        return holdSwitch ? switchAnswer : new Response("{}", { status: 404 });
      return new Response(
        events
          .map((e) => (e.type === "build" ? { ...e, replayed: true } : e))
          .map((event) => JSON.stringify(event))
          .join("\n") + "\n",
        { headers: { "content-type": "application/x-ndjson" } },
      );
    }),
  );
  /** Answers the switch's request, and lets the screen take the answer, on no clock. */
  const answerSwitch = () =>
    act(async () => {
      answer(Response.json(switchData));
      for (let turn = 0; turn < 10; turn++)
        await new Promise((resolve) => setImmediate(resolve));
    });
  // Each commit of the first screen, so a test can tell that it re-rendered.
  const commits: string[] = [];
  render(
    <Profiler id="first-screen" onRender={(_id, phase) => commits.push(phase)}>
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
      />
    </Profiler>,
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
  return { animate, cancel, lantern, mid, resize, answerSwitch, commits };
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

// WS18, post-deploy brief item 1: a re-render of the first screen while a venue's cards fly
// leaves each card's flight running, once (it cancelled and restarted every card). In a browser
// two things re-render the screen mid-step: a resize across the short-laptop line (760 px tall,
// 1250 px wide), and the venue switch's answer, which after a live run comes during Watch (the
// run's "done" arrives before the server has saved it, so the switch asks again 1.5 s later).
describe.each([
  { speed: "at full speed", latency: 0 },
  { speed: "on a slow machine", latency: SLOW_MS },
])("Watch's cards in flight, $speed", ({ latency }) => {
  it("fly once when a resize across the short-laptop line re-renders the screen", async () => {
    const { animate, cancel, lantern, mid, resize, commits } = await watchOn({
      wide: true,
      latency,
    });
    const cards = [...document.querySelectorAll(".fly-card")];
    expect(cards).toHaveLength(lantern.length);
    const before = commits.length;
    act(() => resize({ short: false }));
    // The screen re-rendered, during the same venue's step.
    expect(commits.length).toBeGreaterThan(before);
    expect(
      within(mid).queryAllByText("With The Lantern Room's fans added"),
    ).toHaveLength(1);
    expect([...document.querySelectorAll(".fly-card")]).toEqual(cards);
    expect(animate).toHaveBeenCalledTimes(cards.length);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("fly once when the venue switch's answer re-renders the screen", async () => {
    const { animate, cancel, lantern, mid, answerSwitch, commits } =
      await watchOn({ wide: true, latency, holdSwitch: true });
    const cards = [...document.querySelectorAll(".fly-card")];
    expect(cards).toHaveLength(lantern.length);
    const before = commits.length;
    await answerSwitch();
    expect(commits.length).toBeGreaterThan(before);
    expect(
      within(mid).queryAllByText("With The Lantern Room's fans added"),
    ).toHaveLength(1);
    expect([...document.querySelectorAll(".fly-card")]).toEqual(cards);
    expect(animate).toHaveBeenCalledTimes(cards.length);
    expect(cancel).not.toHaveBeenCalled();
  });
});
