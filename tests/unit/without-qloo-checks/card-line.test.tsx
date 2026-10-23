// @vitest-environment jsdom
// Daniel's brief of 2026-10-22 (prompt-4), step 3: each Without Qloo card's line, size first,
// from the cache-only checks, in place of "Picked without Qloo: no venue data, no fee check";
// and the per-check line under the toggle. Invented names and numbers.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pickCheckLine } from "@/components/chart/words";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodPage } from "@/components/method-page";
import { ModelBill } from "@/components/model-bill";
import type { LlmOnlyLineup, PickCheck } from "@/lib/llm-only";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const found = (
  popularity: number,
  range: "in" | "above" | "below",
  genres = 2,
  climb: number | null = null,
): PickCheck => ({
  name: "Someone",
  status: "found",
  popularity,
  range,
  genres,
  climb,
});
const line = (check: PickCheck) => pickCheckLine(check, SAGEBRUSH_SOUND);

describe("a Without Qloo card's line, size first", () => {
  it("reads as the brief's examples do", () => {
    expect(line(found(0.963, "above", 2, null))).toBe(
      "Picked without Qloo; on Qloo: popularity 96th, above the mid-size range · 2 genres shared · no climb with Boise's venues",
    );
    expect(line({ name: "Someone", status: "not-found" })).toBe(
      "Picked without Qloo; not found on Qloo",
    );
  });

  it("says not checked when the cache held nothing, or no check came with the answer", () => {
    expect(line({ name: "Someone", status: "not-checked" })).toBe(
      "Picked without Qloo; not checked on Qloo",
    );
    expect(pickCheckLine(undefined, SAGEBRUSH_SOUND)).toBe(
      "Picked without Qloo; not checked on Qloo",
    );
  });

  it("names the range, rounds down, and never shows a pick over the top edge as the edge", () => {
    expect(line(found(0.92, "in"))).toContain(
      "popularity 92nd, in the mid-size range ·",
    );
    expect(line(found(0.9201, "above"))).toContain(
      "popularity 93rd, above the mid-size range ·",
    );
    expect(line(found(0.93, "above"))).toContain("popularity 93rd, above");
    expect(line(found(0.8, "in"))).toContain(
      "popularity 80th, in the mid-size range ·",
    );
    expect(line(found(0.7999, "in"))).toContain(
      "popularity 79th, in the opening range ·",
    );
    expect(line(found(0.55, "in"))).toContain(
      "popularity 55th, in the opening range ·",
    );
    expect(line(found(0.5499, "below"))).toContain(
      "popularity 54th, below the opening range ·",
    );
  });

  it("counts the genres shared and says whether a venue's fans lift it", () => {
    expect(line(found(0.86, "in", 1, 7))).toBe(
      "Picked without Qloo; on Qloo: popularity 86th, in the mid-size range · 1 genre shared · a climb with one of Boise's venues",
    );
    expect(line(found(0.6, "in", 0, 0))).toContain(
      "· no genres shared · no climb with Boise's venues",
    );
    expect(line(found(0.6, "in", 3, -4))).toContain(
      "· 3 genres shared · no climb with Boise's venues",
    );
  });

  it("names the festival's own town", () => {
    expect(
      pickCheckLine(found(0.97, "above"), {
        ...SAGEBRUSH_SOUND,
        city: "Austin",
      }),
    ).toMatch(/no climb with Austin's venues$/);
  });
});

const LINEUP: LlmOnlyLineup = {
  festivalId: SAGEBRUSH_SOUND.id,
  createdAt: "2026-10-15T14:02:00.000Z",
  picks: [
    { name: "Alpha Hum", note: "An invented reason." },
    { name: "Beta Glow", note: "Another invented reason." },
    { name: "Gamma Drift", note: "A third invented reason." },
  ],
};

describe("each card, one line in the small style", () => {
  it("puts each pick's own line where the old one was, matched by name", () => {
    const checks: PickCheck[] = [
      { name: "Beta Glow", status: "not-found" },
      { ...found(0.86, "in", 2, 6), name: "Alpha Hum" },
    ];
    render(
      <ModelBill
        festival={SAGEBRUSH_SOUND}
        state={{ status: "ready", lineup: LINEUP, error: null, checks }}
        onRetry={() => {}}
      />,
    );
    const card = (name: string) => screen.getByRole("article", { name });
    const small = (name: string) =>
      [...card(name).querySelectorAll("p.pick-none")].map((p) => p.textContent);
    expect(small("Alpha Hum")).toEqual([
      "Picked without Qloo; on Qloo: popularity 86th, in the mid-size range · 2 genres shared · a climb with one of Boise's venues",
    ]);
    expect(small("Beta Glow")).toEqual([
      "Picked without Qloo; not found on Qloo",
    ]);
    expect(small("Gamma Drift")).toEqual([
      "Picked without Qloo; not checked on Qloo",
    ]);
    // Still a name, the model's note and one small line per card.
    for (const pick of LINEUP.picks)
      expect(card(pick.name).querySelectorAll("p")).toHaveLength(2);
    expect(screen.queryByText(/no venue data, no fee check/)).toBeNull();
  });
});

const CHECKS_LINE =
  "Across 29 towns, the model alone picked 290 acts; Qloo found 268 of them. Of those 268, 204 sit above the fee range, 235 share two genres with the headliners, and 10 pass all three of the rule's checks.";
const OLD_LINE =
  /^Across \d+ towns, the model alone and Qloo share [^,]+(, in [^,]+)?, and \d+ of the model's \d+ picks pass all three checks\.$/;

function open(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === "/api/llm-only"
        ? Response.json(body)
        : new Response("", { status: 404 }),
    ),
  );
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Without Qloo: an AI model's picks alone",
    }),
  );
  return screen.findAllByRole("article", {}, { timeout: 5000 });
}

describe("the Without Qloo view", () => {
  it("shows the checks the server sends with the answer", async () => {
    const checks: PickCheck[] = [
      { ...found(0.97, "above", 2, null), name: "Alpha Hum" },
      { name: "Beta Glow", status: "not-found" },
      { name: "Gamma Drift", status: "not-checked" },
    ];
    const cards = await open({ lineup: LINEUP, cached: true, checks });
    expect(
      cards.map((card) => card.querySelector(".pick-none")!.textContent),
    ).toEqual([
      "Picked without Qloo; on Qloo: popularity 97th, above the mid-size range · 2 genres shared · no climb with Boise's venues",
      "Picked without Qloo; not found on Qloo",
      "Picked without Qloo; not checked on Qloo",
    ]);
  });

  it("says not checked on every card when no checks, or unreadable ones, come with the answer", async () => {
    for (const body of [
      { lineup: LINEUP, cached: true },
      { lineup: LINEUP, cached: true, checks: [{ name: "Alpha Hum" }] },
    ]) {
      const cards = await open(body);
      expect(
        cards.map((card) => card.querySelector(".pick-none")!.textContent),
      ).toEqual(
        LINEUP.picks.map(() => "Picked without Qloo; not checked on Qloo"),
      );
      cleanup();
    }
  });

  it("has the per-check line under the toggle, on both sides of it", async () => {
    await open({ lineup: LINEUP, cached: true });
    const toggle = screen.getByRole("group", { name: "Which bill" });
    const under = screen.getByText(CHECKS_LINE);
    expect(toggle.parentElement!.contains(under)).toBe(true);
    expect(
      toggle.compareDocumentPosition(under) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText(OLD_LINE)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "With Qloo: the AI agent's lineup" }),
    );
    expect(screen.getByText(CHECKS_LINE)).toBeTruthy();
  });

  it("leaves How it works its own line", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    render(
      <MethodPage
        story={methodStory(SAGEBRUSH_SOUND, FIRST_BILL)!}
        videoUrl={null}
      />,
    );
    expect(screen.getByText(OLD_LINE)).toBeTruthy();
    expect(screen.queryByText(CHECKS_LINE)).toBeNull();
  });
});
