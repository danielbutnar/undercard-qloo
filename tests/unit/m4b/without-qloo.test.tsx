// @vitest-environment jsdom
// Without Qloo on the poster (WS9): the same headliners, then the model's picks as one list
// with no slots, each tagged from prompt 4's checks, each opening its card with the model's own
// reason; the town stands pale with a note that the model can't see its venues.
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

describe("the poster's tabs", () => {
  it("say what each side shows, with the tab's own short words", () => {
    answered();
    const group = screen.getByRole("group", { name: "Which bill" });
    const tabs = within(group).getAllByRole("button");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "With Qloo",
      "Without Qloo",
    ]);
    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual([
      WITH,
      WITHOUT,
    ]);
    expect(
      within(group)
        .getByRole("button", { name: WITH })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

describe("Without Qloo", () => {
  it("reprints the poster with the model's picks under the same headliners, picked by the model alone", async () => {
    const fetch = answered();
    flip(WITHOUT);
    const sheet = await modelBill();
    expect(fetch).toHaveBeenCalledWith(
      "/api/llm-only",
      expect.objectContaining({ method: "POST" }),
    );
    expect(modelCalls(fetch)).toHaveLength(1);
    expect(
      within(sheet).getByText("Picked by Claude Sonnet 5.5 alone"),
    ).toBeTruthy();
    // The poster is "The festival" now, and the headliners stay above the picks in it.
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
    // One list, titled with the model's own count, never sorted into slots.
    expect(within(sheet).getByText("The model's 10 picks")).toBeTruthy();
    expect(
      within(sheet).queryByRole("region", { name: "Mid-size acts" }),
    ).toBeNull();
  });

  it("tags each pick from prompt 4's checks, and opens its card with the model's own reason", async () => {
    answered();
    flip(WITHOUT);
    const sheet = await modelBill();
    const picks = await picksOf(sheet);
    expect(picks.map((pick) => pick.getAttribute("aria-label"))).toEqual(
      lineup.picks.map((pick) => pick.name),
    );
    for (const [index, pick] of picks.entries()) {
      // This answer came with no checks: each tag and line says so.
      expect(within(pick).getByText("not checked on Qloo")).toBeTruthy();
      expect(
        within(pick).getByText("Picked without Qloo; not checked on Qloo"),
      ).toBeTruthy();
      // WS8: every pick came with the model's reason, so each shows it under its name.
      expect(within(pick).getByText(lineup.picks[index].note)).toBeTruthy();
      fireEvent.click(
        within(pick).getByRole("button", { name: lineup.picks[index].name }),
      );
      const card = screen.getByRole("region", { name: "The model's pick" });
      expect(within(card).getByText(lineup.picks[index].note)).toBeTruthy();
      expect(card.textContent).toMatch(/^.+The model's reason: /);
    }
    // A second click on the same name closes its card.
    const last = picks.at(-1)!;
    fireEvent.click(
      within(last).getByRole("button", { name: lineup.picks.at(-1)!.name }),
    );
    expect(
      screen.queryByRole("region", { name: "The model's pick" }),
    ).toBeNull();
  });

  it("puts no score, tally or 0/10 anywhere", async () => {
    answered();
    flip(WITHOUT);
    await picksOf(await modelBill());
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(text).not.toMatch(/\bscore\b/i);
  });

  it("says over the town that the model can't see its venues, with nothing of the AI agent's beside the picks", async () => {
    answered(syntheticVenueSwitch());
    const KEY = { name: "Venue fans used for this draft" };
    const toggles = () =>
      within(screen.getByRole("group", KEY)).getAllByRole(
        "button",
      ) as HTMLButtonElement[];
    // With Qloo, once the saved build's venue results are in, every venue can be switched.
    await waitFor(() =>
      expect(toggles().every((toggle) => !toggle.disabled)).toBe(true),
    );
    flip(WITHOUT);
    await picksOf(await modelBill());
    const note = screen.getByRole("note", { name: "Without Qloo" });
    expect(note.textContent).toMatch(
      /^Without Qloo, the model can't see Boise's venues\.Same model as the agent \(Claude Sonnet 5\.5\), same brief, no Qloo: it picks without reading any venue's fans/,
    );
    expect(
      within(screen.getByRole("region", { name: "Your town" })).getByText(
        /^No venues read\./,
      ),
    ).toBeTruthy();
    // The model's picks stand alone: no venues, no Qloo calls, no rule, no credit to the agent.
    expect(screen.queryByRole("group", KEY)).toBeNull();
    expect(
      screen.queryByRole("region", { name: "The AI agent's setlist" }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "The door check" }),
    ).toBeNull();
    expect(
      screen.queryByRole("complementary", { name: "Qloo calls" }),
    ).toBeNull();
    expect(
      screen.queryByRole("region", { name: "How an act gets on" }),
    ).toBeNull();
    expect(
      screen.getByRole("region", { name: "The festival" }).textContent,
    ).not.toMatch(
      /Drafted by Undercard|Drafted from \d+ Qloo calls|AI agent planned/,
    );
    // The note's button, like the tab, brings the venues back, with their switches, and the
    // agent's credit.
    fireEvent.click(
      within(note).getByRole("button", { name: "Show it with Qloo" }),
    );
    expect(toggles().every((toggle) => !toggle.disabled)).toBe(true);
    expect(screen.queryByRole("note", { name: "Without Qloo" })).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Undercard draft" })).getByText(
        "Drafted by Undercard",
      ),
    ).toBeTruthy();
  });

  it("flips back to the agent's poster with its marks", async () => {
    answered();
    flip(WITHOUT);
    await modelBill();
    flip(WITH);
    const draft = screen.getByRole("region", { name: "Undercard draft" });
    // The act's mark: the venue whose fans lifted it, in words for a screen reader, and the climb
    // beside its name (M10a).
    const act = within(draft).getByRole("article", { name: "Hollow Pines" });
    expect(
      within(act).getByText(
        "With The Lantern Room's fans added: up 11 places in Qloo's ranking",
      ),
    ).toBeTruthy();
    expect(act.querySelector(".poster-climb")!.textContent).toBe("↑11");
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
