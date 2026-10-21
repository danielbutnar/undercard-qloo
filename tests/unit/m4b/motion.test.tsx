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
import {
  syntheticBuildStream,
  syntheticRefillStream,
} from "../../e2e/synthetic-build";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts as lineup, FIRST_BILL } from "./first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NDJSON = { headers: { "content-type": "application/x-ndjson" } };
const PRINT = "motion-safe:animate-print-in";
// The lineup prints in 0.12 s apart.
const STEP = 0.12;

function open({ reducedMotion = false } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reducedMotion && query.includes("reduce"),
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) =>
      url === "/api/refill"
        ? new Response(
            syntheticRefillStream(JSON.parse(String(init?.body)).unavailableId),
            NDJSON,
          )
        : url.startsWith("/api/venue-switch")
          ? // The venue switch reads the saved build's results on mount: not a build.
            new Response(null, { status: 404 })
          : new Response(syntheticBuildStream({ replayed: true }), NDJSON),
    ),
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

// Watch sits in the lead beside the chart. With no climb in the stream there is no edition to
// play, so the lineup comes back as soon as the build is in.
async function watch() {
  fireEvent.click(
    screen.getByRole("button", { name: "Watch how it picked these acts" }),
  );
  await waitFor(() => expect(acts()).toHaveLength(10));
}

describe("the motion moment", () => {
  it("doesn't play on first paint: the bill is already finished", () => {
    open();
    for (const article of acts())
      expect(article.className).not.toContain(PRINT);
    expect(lantern().textContent).toMatch(/^The Lantern Room7 acts lifted/);
  });

  it("prints the undercard in one act at a time when the replay's lineup lands", async () => {
    open();
    await watch();
    await waitFor(() =>
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
    open();
    await watch();
    await waitFor(() =>
      expect(acts().every((article) => article.className.includes(PRINT))).toBe(
        true,
      ),
    );
    expect(lantern().textContent).toMatch(/^The Lantern Room7 acts lifted/);
  });

  it("shows the end state at once under reduced motion", async () => {
    open({ reducedMotion: true });
    await watch();
    expect(lantern().textContent).toMatch(/^The Lantern Room7 acts lifted/);
    for (const article of acts())
      expect(article.className).not.toContain(PRINT);
  });

  async function refillHollowPines() {
    open();
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
    await waitFor(() =>
      expect(
        within(bill()).getByRole("article", { name: "Sego Lily" }),
      ).toBeTruthy(),
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
