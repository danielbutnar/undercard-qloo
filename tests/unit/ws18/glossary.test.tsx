// @vitest-environment jsdom
// WS18 item 1 (Daniel, 29 October, 15:00): one evidence story everywhere. WS16's glossary test,
// brought forward: every screen's words, read as a visitor reads them, fail on three vs four
// checks, on "books" for Undercard's picks, on popularity as an ordinal and on a tier called
// anything but mid-size or opening. The three checks read the same on the card, the ticket, the
// poster's key and How it works. Text the model wrote stays as written, so its notes are left
// out. Invented acts and venues throughout.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodPage } from "@/components/method-page";
import { MethodEvidencePage } from "@/components/method-evidence";
import { ShortlistScreen } from "@/components/shortlist/shortlist-screen";
import { YourFestival } from "@/components/your-festival";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { callBudget, checkShortlist } from "@/server/shortlist";
import {
  syntheticLlmOnly,
  syntheticVenueSwitch,
} from "../../e2e/synthetic-build";
import { qlooWorld, savedBuild, shortlistQloo } from "../shortlist/world";
import { TWO_ACTS, TWO_BILL } from "./two-bill";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

// Daniel's words for the three checks (WS18 item 1).
const CHECKS = [
  "It climbs at least 5 places with a town venue's fans, and at least 5 more than with a venue abroad of similar Qloo popularity.",
  "Its popularity is inside the tier's range.",
  "It shares two genres with the headliners.",
];
const CONTROL_LINE =
  "Fans of any busy venue lift some acts; a venue abroad with similar Qloo popularity shows how much of the climb is this town's.";
const README_LINE =
  "The AI agent plans the Qloo calls, Qloo knows the taste, and a fixed rule picks the acts. The buyer makes every call.";

const { lineup } = syntheticLlmOnly();
const MODEL_NOTES = lineup.picks.map((pick) => pick.note);

/** What a visitor reads: the visible words, no screen-reader-only ones, and the model's notes left out. */
function words(node: Element = document.body): string {
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".sr-only").forEach((child) => child.remove());
  // Each element's words apart, so "3rd" and "↑11" don't run into one token.
  clone.querySelectorAll("*").forEach((child) => child.append(" "));
  let text = (clone.textContent ?? "").replace(/\s+/g, " ");
  for (const note of MODEL_NOTES) text = text.split(note).join(" ");
  return text;
}
/** The labels screen readers get, which are user-facing strings too. */
const labels = () =>
  [...document.querySelectorAll("[aria-label]")]
    .map((node) => node.getAttribute("aria-label"))
    .join(" | ");

const stub = (other: (url: string) => Promise<Response>) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/venue-switch")
        ? Response.json(syntheticVenueSwitch())
        : other(url),
    ),
  );

function landing() {
  stub(async () => new Response("", { status: 404 }));
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={TWO_BILL} />);
}
const card = () => screen.getByRole("region", { name: "Act card" });
function openCard(name: string) {
  fireEvent.click(
    within(screen.getByRole("article", { name })).getByRole("button", {
      name,
    }),
  );
  return card();
}
function howItWorks() {
  stub(async () => new Response(null, { status: 404 }));
  render(
    <MethodPage
      story={methodStory(SAGEBRUSH_SOUND, TWO_BILL)!}
      videoUrl={null}
    />,
  );
}
async function withoutQloo() {
  const checks = lineup.picks.map((pick, n) => ({
    name: pick.name,
    status: "found" as const,
    popularity: 0.93 - n * 0.04,
    range: n < 4 ? "above" : n < 8 ? "in" : "below",
    genres: n % 3,
    climb: n === 2 ? 6 : null,
  }));
  stub(async () => Response.json({ lineup, cached: true, checks }));
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={TWO_BILL} />);
  fireEvent.click(screen.getByRole("button", { name: /^Without Qloo/ }));
  await screen.findAllByText(/· (above|below|in) /);
}
async function pitchCheck() {
  const world = qlooWorld(shortlistQloo());
  const names = ["Marigold Static", "Velvet Coyote", "Nobody Knows Us"];
  const shortlist = await checkShortlist({
    festival: SAGEBRUSH_SOUND,
    build: savedBuild(),
    names,
    budget: callBudget({ ...world, cap: 14 }),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ shortlist })),
  );
  render(<ShortlistScreen />);
  fireEvent.change(
    screen.getByRole("textbox", { name: /acts you've been pitched/i }),
    { target: { value: names.join("\n") } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Sort them on Qloo" }));
  await screen.findByRole("complementary", { name: "Qloo calls" });
}

/** Every screen's words, each rendered as a visitor opens it. */
async function everyScreen(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  landing();
  openCard(TWO_ACTS[1].name);
  out.landing = `${words()} ${labels()}`;
  cleanup();
  await withoutQloo();
  out.without = `${words()} ${labels()}`;
  cleanup();
  howItWorks();
  out.how = `${words()} ${labels()}`;
  cleanup();
  render(<MethodEvidencePage />);
  out.evidence = `${words()} ${labels()}`;
  cleanup();
  await pitchCheck();
  out.pitch = `${words()} ${labels()}`;
  cleanup();
  render(<YourFestival />);
  out.yours = `${words()} ${labels()}`;
  cleanup();
  return out;
}

describe("the glossary on every screen (WS16's test, brought forward)", () => {
  // Every screen rendered once, for all four checks (six screens take a while on a busy machine).
  let pages: Record<string, string> = {};
  beforeAll(async () => {
    pages = await everyScreen();
  }, 120_000);

  it("names a tier mid-size or opening, never mid-tier, opener-tier or a band", () => {
    for (const [page, text] of Object.entries(pages)) {
      // The headliners are bands: that's the music word, not a tier.
      const tiers = text.replace(/The headliners, two bands,/g, "");
      expect([page, tiers.match(/\bmid-tier\b/gi)]).toEqual([page, null]);
      expect([page, tiers.match(/\bopener(?:-|\s)?tier\b/gi)]).toEqual([
        page,
        null,
      ]);
      expect([page, tiers.match(/\bopeners?\b/gi)]).toEqual([page, null]);
      expect([page, tiers.match(/\bbands?\b/gi)]).toEqual([page, null]);
    }
  });

  it("says Undercard drafts and picks, never that it or its rule books", () => {
    for (const [page, text] of Object.entries(pages)) {
      expect([page, text.match(/\b(?:only books|rule books)\b/gi)]).toEqual([
        page,
        null,
      ]);
      // Undercard or its rule as the one booking; festivals and buyers still book.
      expect([
        page,
        text.match(
          /\bUndercard(?: [12]\.0)? (?:only )?book(?:s|ed)\b|\b(?:acts|picks) Undercard(?: [12]\.0)? booked\b/gi,
        ),
      ]).toEqual([page, null]);
      expect([page, text.match(/\bbooking unchanged\b/gi)]).toEqual([
        page,
        null,
      ]);
    }
  });

  it("gives popularity out of 100, never as an ordinal", () => {
    for (const [page, text] of Object.entries(pages)) {
      expect([page, text.match(/\bpercentile\b/gi)]).toEqual([page, null]);
      expect([
        page,
        text.match(/popularity:?\s+\d{1,3}(?:st|nd|rd|th)\b/gi),
      ]).toEqual([page, null]);
      expect([
        page,
        text.match(/\b\d{1,3}(?:st|nd|rd|th)\s*·\s*(?:above|below|in)\b/g),
      ]).toEqual([page, null]);
      expect([
        page,
        text.match(/\d{1,3}(?:st|nd|rd|th)\s*[–-]\s*\d{1,3}(?:st|nd|rd|th)/g),
      ]).toEqual([page, null]);
    }
    // Where an act's popularity shows, it reads as Daniel's "86/100".
    expect(pages.landing).toMatch(/Popularity \d{2}\/100/);
    expect(pages.without).toMatch(/\b\d{2}\/100 · above both ranges/);
    expect(pages.pitch).toMatch(/Qloo popularity \d{2}\/100/);
  });

  it("says three checks wherever it counts them, and lists three", () => {
    for (const [page, text] of Object.entries(pages)) {
      expect([page, text.match(/\bfour checks\b/gi)]).toEqual([page, null]);
      // The local lift is part of the first check, not a fourth condition.
      expect([page, text.match(/a local lift of \d+ or more over/gi)]).toEqual([
        page,
        null,
      ]);
      expect([page, text.match(/passes them all/gi)]).toEqual([page, null]);
      expect([page, text.match(/against its control/gi)]).toEqual([page, null]);
    }
  });
});

describe("one evidence story: the three checks in the same words", () => {
  it("on the card, with the act's two climbs and its local lift", () => {
    landing();
    const marisol = TWO_ACTS[1];
    const opened = openCard(marisol.name);
    const text = words(opened);
    for (const check of CHECKS) expect(text).toContain(check);
    // Daniel's example line: ↑7 with the venue's fans, ↓15 abroad, a local lift of 22.
    expect(text).toContain(
      `↑7 with ${marisol.anchorVenue.name}'s fans, ↓15 abroad: a local lift of 22 (bar 5)`,
    );
    // Why it's here names both climbs and the local lift.
    const why = within(opened)
      .getByText(/Why it's here/)
      .closest("p")!;
    expect(why.textContent).toMatch(/\b7\b/);
    expect(why.textContent).toMatch(/\b15\b/);
    expect(why.textContent).toMatch(/local lift of 22/);
    expect(text).not.toMatch(/a venue in Elsewhere/);
  });

  it("on the ticket, whose local lift draws its ↑ as an SVG, not Anton's arrow", () => {
    landing();
    const door = screen.getByRole("region", { name: "The door check" });
    const text = words(door);
    for (const check of CHECKS) expect(text).toContain(check);
    const stamp = door.querySelector(".stamp-climb .stamp-big")!;
    expect(stamp.querySelector("svg")).not.toBeNull();
    expect(stamp.textContent).not.toContain("↑");
    expect(text).not.toMatch(/a venue in Elsewhere/);
  });

  // The key's marks stay above the acts, so the first screen keeps every act in view; the checks
  // follow the acts, inside the poster.
  it("on the poster's key, with the control's one line where the control first appears", () => {
    landing();
    const text = words();
    const key = document.querySelector(".poster-checks")!;
    for (const check of CHECKS) expect(words(key)).toContain(check);
    expect(text.split(CONTROL_LINE)).toHaveLength(2);
    // The line follows the page's first mention of the venue abroad.
    const first = text.indexOf("a venue abroad");
    expect(text.indexOf(CONTROL_LINE)).toBeGreaterThan(first);
    expect(text.indexOf(CONTROL_LINE) - first).toBeLessThan(400);
  });

  it("on How it works, with the control's line, the README's who-does-what line and the SHOWN clause", () => {
    howItWorks();
    const text = words();
    const door = screen.getByRole("region", { name: /^Scene 3: / });
    for (const check of CHECKS) expect(words(door)).toContain(check);
    expect(text.split(CONTROL_LINE)).toHaveLength(2);
    const first = text.indexOf("a venue abroad");
    expect(text.indexOf(CONTROL_LINE)).toBeGreaterThan(first);
    expect(text.indexOf(CONTROL_LINE) - first).toBeLessThan(400);
    expect(text).toContain(README_LINE);
    expect(text).not.toContain("Qloo decides, the model plans");
    const shown = document.querySelector(".dc-verdict-shown")!;
    expect(words(shown)).toContain(
      "244 of the 290 acts Undercard 1.0 drafted (its bills of 17 and 18 October)",
    );
    expect(words(shown)).toContain(
      "the bills on show now hold only acts that pass that test",
    );
  });
});
