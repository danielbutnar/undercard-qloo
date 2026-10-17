// @vitest-environment jsdom
import {
  act,
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
import { FIRST_BILL } from "./first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NDJSON = { headers: { "content-type": "application/x-ndjson" } };
const PRINT = "motion-safe:animate-print-in";

function open({ reducedMotion = false } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reducedMotion && query.includes("reduce"),
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) =>
      url === "/api/refill"
        ? new Response(
            syntheticRefillStream(JSON.parse(String(init.body)).unavailableId),
            NDJSON,
          )
        : new Response(syntheticBuildStream({ replayed: true }), NDJSON),
    ),
  );
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);
}
const bill = () => screen.getByRole("region", { name: "Undercard draft" });
const acts = () => within(bill()).queryAllByRole("article");
const lantern = () =>
  within(
    screen.getByRole("region", { name: "Boise venue crowds behind this bill" }),
  )
    .getAllByRole("listitem")
    .find((item) => item.textContent?.startsWith("The Lantern Room"))!;
// jsdom has no AnimationEvent, so React listens for the prefixed name there.
const printStarts = (article: Element) =>
  article.dispatchEvent(new Event("webkitAnimationStart", { bubbles: true }));

async function watch() {
  fireEvent.click(
    within(screen.getByRole("complementary", { name: "Qloo calls" })).getByRole(
      "button",
      { name: "Watch the agent build it" },
    ),
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
    expect(acts().map((article) => article.className.includes(PRINT))).toEqual(
      Array(10).fill(true),
    );
    expect(acts().map((article) => article.style.animationDelay)).toEqual(
      Array.from({ length: 10 }, (_, i) => `${Number((i * 0.12).toFixed(2))}s`),
    );
  });

  it("ticks each room's count up as its acts print in", async () => {
    open();
    await watch();
    expect(lantern().textContent).toMatch(/^The Lantern Room0 lifted none/);
    const [first, second] = acts();
    act(() => {
      printStarts(first);
    });
    expect(lantern().textContent).toMatch(/^The Lantern Room1 act lifted/);
    act(() => {
      printStarts(second); // Fort Street Ballroom's
      for (const article of acts()) printStarts(article);
    });
    expect(lantern().textContent).toMatch(/^The Lantern Room7 acts lifted/);
  });

  it("shows the end state at once under reduced motion", async () => {
    open({ reducedMotion: true });
    await watch();
    expect(lantern().textContent).toMatch(/^The Lantern Room7 acts lifted/);
  });

  it("prints a refill's replacement into its slot without replaying the rest", async () => {
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
    const replacement = within(bill()).getByRole("article", {
      name: "Sego Lily",
    });
    expect(replacement.className).toContain(PRINT);
    expect(replacement.style.animationDelay).toBe("0s");
    for (const article of acts().filter((a) => a !== replacement))
      expect(article.className).not.toContain(PRINT);
  });
});
