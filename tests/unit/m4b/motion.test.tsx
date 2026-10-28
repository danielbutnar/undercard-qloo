// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  syntheticBuildStream,
  syntheticRefillStream,
} from "../../e2e/synthetic-build";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts as lineup, FIRST_BILL } from "./first-bill-fixture";

// The tests read a clock they move themselves, never the wall clock (Daniel, 2026-10-28), so a
// loaded machine can't fail them: promises, the stream and React's renders still run for real.
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

const NDJSON = { headers: { "content-type": "application/x-ndjson" } };
const PRINT = "motion-safe:animate-print-in";
// The lineup prints in 0.12 s apart.
const STEP = 0.12;
// A slow machine, simulated on the clock: every answer arrives this long after its request.
const SLOW_MS = 2_000;

function open({ reducedMotion = false, latency = 0 } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reducedMotion && query.includes("reduce"),
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (latency) await new Promise((resolve) => setTimeout(resolve, latency));
      return url === "/api/refill"
        ? new Response(
            syntheticRefillStream(JSON.parse(String(init?.body)).unavailableId),
            NDJSON,
          )
        : url.startsWith("/api/venue-switch")
          ? // The venue switch reads the saved build's results on mount: not a build.
            new Response(null, { status: 404 })
          : new Response(syntheticBuildStream({ replayed: true }), NDJSON);
    }),
  );
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);
}
const bill = () => screen.getByRole("region", { name: "Undercard draft" });
const acts = () => within(bill()).queryAllByRole("article");
const lantern = () =>
  within(
    screen.getByRole("region", {
      name: "Boise venues whose fans shaped this lineup",
    }),
  )
    .getAllByRole("listitem")
    .find((item) => item.textContent?.startsWith("The Lantern Room"))!;
const delayOf = (article: Element) =>
  Number.parseFloat((article as HTMLElement).style.animationDelay);

/**
 * Waits for `check` to pass on the test's own clock, never the wall clock: between checks it
 * moves the fake clock to the page's next timer, if there is one, and gives the stream and
 * React's scheduler a few real turns of the event loop. It gives up after 100 such steps,
 * however long the machine takes. As Testing Library's waitFor does, React runs outside act()
 * meanwhile: act() would wait for a refill that waits for the clock.
 */
async function settle(check: () => void) {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const actEnvironment = scope.IS_REACT_ACT_ENVIRONMENT;
  scope.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    for (let step = 0; ; step++) {
      try {
        check();
        return;
      } catch (error) {
        if (step >= 100) throw error;
      }
      await vi.advanceTimersToNextTimerAsync();
      for (let turn = 0; turn < 3; turn++)
        await new Promise((resolve) => setImmediate(resolve));
    }
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
  }
}

// Watch sits in the lead beside the chart. With no climb in the stream there is no edition to
// play, so the lineup comes back as soon as the build is in.
async function watch() {
  fireEvent.click(
    screen.getByRole("button", { name: "Watch how it picked these acts" }),
  );
  await settle(() => expect(acts()).toHaveLength(10));
}

describe.each([
  { speed: "at full speed", latency: 0 },
  { speed: "on a slow machine", latency: SLOW_MS },
])("the motion moment, $speed", ({ latency }) => {
  it("doesn't play on first paint: the bill is already finished", () => {
    open({ latency });
    for (const article of acts())
      expect(article.className).not.toContain(PRINT);
    expect(lantern().textContent).toMatch(/^The Lantern Room7 acts lifted/);
  });

  it("prints the undercard in one act at a time when the replay's lineup lands", async () => {
    open({ latency });
    await watch();
    await settle(() =>
      expect(
        acts().map((article) => article.className.includes(PRINT)),
      ).toEqual(Array(10).fill(true)),
    );
    // Down the chart as it is drawn, 0.12 s apart, the two bands' rows side by side: a band's
    // nth row waits (2n + column) steps.
    const delays = new Map(
      acts().map((article) => [
        article.getAttribute("aria-label"),
        delayOf(article),
      ]),
    );
    expect([...delays.keys()].sort()).toEqual(
      lineup.map((act) => act.name).sort(),
    );
    ["Mid-size acts", "Opening acts"].forEach((band, column) =>
      within(screen.getByRole("region", { name: band }))
        .getAllByRole("article")
        .forEach((article, index) =>
          expect(delays.get(article.getAttribute("aria-label"))).toBeCloseTo(
            (index * 2 + column) * STEP,
            5,
          ),
        ),
    );
  });

  it("shows each venue's full count while its acts print in: the counts don't tick up", async () => {
    open({ latency });
    await watch();
    await settle(() =>
      expect(acts().every((article) => article.className.includes(PRINT))).toBe(
        true,
      ),
    );
    expect(lantern().textContent).toMatch(/^The Lantern Room7 acts lifted/);
  });

  it("brings the lineup back without printing in under reduced motion", async () => {
    open({ reducedMotion: true, latency });
    await watch();
    expect(lantern().textContent).toMatch(/^The Lantern Room7 acts lifted/);
    for (const article of acts())
      expect(article.className).not.toContain(PRINT);
  });

  async function refillHollowPines() {
    open({ latency });
    fireEvent.click(
      within(bill()).getByRole("button", { name: "Hollow Pines" }),
    );
    fireEvent.click(
      within(screen.getByRole("region", { name: "Act card" })).getByRole(
        "button",
        { name: "Unavailable" },
      ),
    );
    // M6e: the card asks why before it refills.
    fireEvent.click(screen.getByRole("button", { name: "Fee" }));
    // A query that doesn't throw: a miss costs no dump of the whole page.
    await settle(() =>
      expect(
        within(bill()).queryAllByRole("article", { name: "Sego Lily" }),
      ).toHaveLength(1),
    );
    return within(bill()).getByRole("article", { name: "Sego Lily" });
  }

  it("puts a refill's replacement on the chart without replaying the rest", async () => {
    const replacement = await refillHollowPines();
    expect(acts()).toHaveLength(10);
    expect(
      within(bill()).queryByRole("article", { name: "Hollow Pines" }),
    ).toBeNull();
    // The lineup isn't replayed: nothing else prints in again.
    for (const article of acts().filter((a) => a !== replacement))
      expect(article.className).not.toContain(PRINT);
  });

  it("prints a refill's replacement into its slot without replaying the rest", async () => {
    const replacement = await refillHollowPines();
    expect(replacement.className).toContain(PRINT);
    expect(delayOf(replacement)).toBe(0);
    for (const article of acts().filter((a) => a !== replacement))
      expect(article.className).not.toContain(PRINT);
  });
});
