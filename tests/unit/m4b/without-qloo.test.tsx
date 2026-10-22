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
  syntheticLlmOnly,
  syntheticVenueSwitch,
} from "../../e2e/synthetic-build";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import type { VenueSwitchData } from "@/lib/venue-switch";
import { FIRST_BILL } from "./first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const WITH = "With Qloo: the AI agent's lineup";
const WITHOUT = "Without Qloo: an AI model's picks alone";
const { lineup } = syntheticLlmOnly();

// The screen also asks GET /api/venue-switch once on mount; unless a test hands it the saved
// build's results it answers 404 (the switch then says it isn't available). Only POST
// /api/llm-only counts as a call to the model.
function open(answer: () => Promise<Response>, venueSwitch?: VenueSwitchData) {
  const fetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async (url) =>
      url.startsWith("/api/venue-switch")
        ? venueSwitch
          ? Response.json(venueSwitch)
          : new Response("", { status: 404 })
        : answer(),
  );
  vi.stubGlobal("fetch", fetch);
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />);
  return fetch;
}
const modelCalls = (fetch: ReturnType<typeof open>) =>
  fetch.mock.calls.filter(([url]) => url === "/api/llm-only");
const answered = (venueSwitch?: VenueSwitchData) =>
  open(async () => Response.json({ lineup, cached: true }), venueSwitch);
const flip = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const modelBill = () =>
  screen.findByRole("region", {
    name: "Without Qloo: an AI model's picks alone",
  });
// The picks print once the model answers; the section itself shows at once, asking.
const picksOf = (sheet: HTMLElement) => within(sheet).findAllByRole("article");

describe("the switch", () => {
  it("says what each side shows", () => {
    answered();
    const group = screen.getByRole("group", { name: "Which bill" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([WITH, WITHOUT]);
    expect(
      within(group)
        .getByRole("button", { name: WITH })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

describe("Without Qloo", () => {
  it("reprints the chart with the model's picks under the same headliners, stamped No Qloo data", async () => {
    const fetch = answered();
    flip(WITHOUT);
    const sheet = await modelBill();
    expect(fetch).toHaveBeenCalledWith(
      "/api/llm-only",
      expect.objectContaining({ method: "POST" }),
    );
    expect(modelCalls(fetch)).toHaveLength(1);
    expect(within(sheet).getByText("No Qloo data")).toBeTruthy();
    // The draft section is "The festival" now, and the headliners stay above the picks in it.
    const festival = screen.getByRole("region", { name: "The festival" });
    expect(festival.contains(sheet)).toBe(true);
    const headliners = within(festival).getByRole("list", {
      name: "Booked headliners",
    });
    expect(
      within(headliners)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(SAGEBRUSH_SOUND.headliners);
    expect(
      headliners.compareDocumentPosition(sheet) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Undercard draft" }),
    ).toBeNull();
  });

  it("gives each pick the model's own reason and two plain facts", async () => {
    answered();
    flip(WITHOUT);
    const sheet = await modelBill();
    const picks = await picksOf(sheet);
    expect(picks.map((pick) => pick.getAttribute("aria-label"))).toEqual(
      lineup.picks.map((pick) => pick.name),
    );
    for (const [index, pick] of picks.entries()) {
      expect(within(pick).getByText(lineup.picks[index].note)).toBeTruthy();
      // Prompt-4: the line says how Qloo places the pick; this answer came with no checks.
      expect(
        within(pick).getByText("Picked without Qloo; not checked on Qloo"),
      ).toBeTruthy();
      // Item 5: a drawn cover in the cover's place, not an empty grey box.
      expect(pick.querySelector("svg.sleeve.pick-sleeve")).not.toBeNull();
      expect(pick.querySelector(".sleeve-blank")).toBeNull();
    }
  });

  it("puts no score, tally or 0/10 anywhere", async () => {
    answered();
    flip(WITHOUT);
    await picksOf(await modelBill());
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(text).not.toMatch(/\bscore\b/i);
  });

  it("says beside the picks what the model got, with nothing of the AI agent's beside them", async () => {
    answered(syntheticVenueSwitch());
    const VENUES = { name: "Boise venues whose fans shaped this lineup" };
    const toggles = () =>
      within(screen.getByRole("region", VENUES)).getAllByRole(
        "button",
      ) as HTMLButtonElement[];
    // With Qloo, once the saved build's venue results are in, every venue can be switched.
    await waitFor(() =>
      expect(toggles().every((toggle) => !toggle.disabled)).toBe(true),
    );
    flip(WITHOUT);
    await picksOf(await modelBill());
    const note = screen.getByRole("complementary", { name: "The model alone" });
    expect(note.textContent).toMatch(/Claude Sonnet 5\.5 with no tools/);
    // The model's picks stand alone: no venues, no Qloo calls, no rule, no credit to the agent.
    expect(screen.queryByRole("region", VENUES)).toBeNull();
    expect(
      screen.queryByRole("complementary", { name: "Qloo calls" }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "How an act gets on" }),
    ).toBeNull();
    expect(
      screen.getByRole("region", { name: "The festival" }).textContent,
    ).not.toMatch(
      /drafted the rest|Drafted from \d+ Qloo calls|AI agent planned/,
    );
    // Flipping back brings the venues, with their switches, and the agent's credit.
    flip(WITH);
    expect(toggles().every((toggle) => !toggle.disabled)).toBe(true);
    expect(
      screen.queryByRole("complementary", { name: "The model alone" }),
    ).toBeNull();
    expect(
      screen.getByRole("region", { name: "Undercard draft" }).textContent,
    ).toMatch(
      /Undercard drafted the rest of the lineup \(the bill\) from Qloo's numbers/,
    );
  });

  it("flips back to the agent's chart with its marks", async () => {
    answered();
    flip(WITHOUT);
    await modelBill();
    flip(WITH);
    const draft = screen.getByRole("region", { name: "Undercard draft" });
    // The row's mark: the venue whose fans lifted it, in words for a screen reader, and the climb
    // as the row's big number (M10a).
    const row = within(draft).getByRole("article", { name: "Hollow Pines" });
    expect(
      within(row).getByText(
        "With The Lantern Room's fans added: up 11 places in Qloo's ranking",
      ),
    ).toBeTruthy();
    expect(row.querySelector(".row-place")!.textContent).toBe("11");
  });

  it("shows the model's error with a way to try again", async () => {
    const fetch = open(async () =>
      Response.json(
        { error: "The model didn't answer. Try again in a minute." },
        { status: 502 },
      ),
    );
    flip(WITHOUT);
    const sheet = await modelBill();
    await waitFor(() =>
      expect(within(sheet).getByRole("alert").textContent).toBe(
        "The model didn't answer. Try again in a minute.",
      ),
    );
    fireEvent.click(within(sheet).getByRole("button", { name: "Try again" }));
    expect(modelCalls(fetch)).toHaveLength(2);
  });
});
