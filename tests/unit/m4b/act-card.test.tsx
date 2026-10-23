// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { syntheticRefillStream } from "../../e2e/synthetic-build";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts, FIRST_BILL } from "./first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const NDJSON = { headers: { "content-type": "application/x-ndjson" } };

// The server's read of where each mid-size act stands now and for the headliners alone
// (src/lib/places.ts), for each act's ladder; the chart sorts a band by climb, biggest first.
const idOf = (name: string) => acts.find((act) => act.name === name)!.entityId;
const BILL = {
  ...FIRST_BILL,
  places: {
    [idOf("Hollow Pines")]: { now: 1, was: 12 },
    [idOf("The Ditch Riders")]: { now: 2, was: 28 },
    [idOf("Marisol Vey")]: { now: 4, was: 11 },
    [idOf("Kestrel & Bloom")]: { now: 6, was: 15 },
  },
};

const open = () =>
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={BILL} />);
const bill = () => screen.getByRole("region", { name: "Undercard draft" });
const actButton = (name: string) =>
  within(bill()).getByRole("button", { name });
const midNames = () =>
  within(within(bill()).getByRole("region", { name: "Mid-size acts" }))
    .getAllByRole("article")
    .map((article) => article.getAttribute("aria-label"));

// The first screen's stylesheet as selector and declaration pairs. jsdom doesn't load it, so
// what a stylesheet does for the act's name (the pointer, the underline) is read from the file.
const CHART_CSS = readFileSync("src/components/chart/first-screen.css", "utf8");
const rules = [
  ...CHART_CSS.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  ),
].map(([, selectors, body]) => ({
  selectors: selectors.split(",").map((s) => s.trim().replace(/\s+/g, " ")),
  body: body.replace(/\s+/g, " "),
}));
const declares = (selector: string, declaration: string) =>
  rules.some(
    (rule) =>
      rule.selectors.includes(selector) && rule.body.includes(declaration),
  );

describe("an act on the bill", () => {
  it("is a button named by the act, with a pointer and an underline on hover and keyboard focus", () => {
    open();
    for (const act of acts) {
      const button = actButton(act.name);
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(button.getAttribute("aria-controls")).toBeNull();
      // WS9: the act's name on the poster, in its own article.
      expect(button.closest("article")?.getAttribute("aria-label")).toBe(
        act.name,
      );
      expect(button.className).not.toMatch(/scale/);
    }
    const name = ".chart-app.fs .poster-act > button";
    expect(declares(name, "cursor: pointer")).toBe(true);
    expect(declares(`${name}:hover`, "text-decoration: underline")).toBe(true);
    expect(
      declares(`${name}:focus-visible`, "text-decoration: underline"),
    ).toBe(true);
    // Nothing on the chart grows on hover.
    expect(
      rules.some(
        (rule) =>
          rule.selectors.some((selector) => selector.includes(":hover")) &&
          /scale/.test(rule.body),
      ),
    ).toBe(false);
  });

  // WS9: the poster's example line ends with what a name does (and the venue switch, once it's
  // ready: here the switch isn't, so the line doesn't offer it).
  it("says what a click does", () => {
    open();
    expect(screen.getByText(/Pick a name for why\.$/)).toBeTruthy();
    expect(screen.queryByText(/switch a venue off above/)).toBeNull();
  });

  it("opens its card under its row: the Why line, Qloo's numbers, the shared tags and Unavailable", () => {
    open();
    fireEvent.click(actButton("Marisol Vey"));
    const card = screen.getByRole("region", { name: "Act card" });
    // Inside its band's list, under the act's row.
    expect(
      within(screen.getByRole("region", { name: "Mid-size acts" })).getByRole(
        "region",
        { name: "Act card" },
      ),
    ).toBe(card);
    const article = within(card).getByRole("article", { name: "Marisol Vey" });
    expect(within(article).getByText("Why it's here:")).toBeTruthy();
    // Plan.md item 5: the why in one sentence, from the saved build's places and climb.
    expect(article.textContent).toMatch(
      /Fans of Fort Street Ballroom rank Marisol Vey \d+(st|nd|rd|th); fans of the headliners alone rank them \d+(st|nd|rd|th)\. That climb of 7 is why Marisol Vey is here\./,
    );
    expect(
      within(article).getByText("Qloo affinity").parentElement?.textContent,
    ).toBe("Qloo affinity0.91");
    expect(
      within(article).getByText("Popularity").parentElement?.textContent,
    ).toBe("Popularity88th");
    expect(
      within(article)
        .getByRole("list", { name: "Tags shared with the headliners" })
        .querySelectorAll("li"),
    ).toHaveLength(2);
    expect(
      within(article).getByRole("button", { name: "Unavailable" }),
    ).toBeTruthy();
    expect(actButton("Marisol Vey").getAttribute("aria-expanded")).toBe("true");
    expect(actButton("Marisol Vey").getAttribute("aria-controls")).toBe(
      card.id,
    );
    expect(card.id).toBe("act-card");
    expect(document.activeElement).toBe(card);
  });

  it("names its venue on a phone by the row tab's label, and in full elsewhere", () => {
    // Daniel's second batch of 2026-10-22, item 5: below 560 px chart.css shows the short line,
    // so it fits in two lines at 375 px; the climb and Why lines keep the full name.
    open();
    fireEvent.click(actButton("Marisol Vey"));
    const card = screen.getByRole("region", { name: "Act card" });
    expect(card.querySelector(".card-venue-short")!.textContent).toBe(
      "Climbs with FSB's fans added",
    );
    expect(card.querySelector(".card-venue-full")!.textContent).toBe(
      "Climbs with Fort Street Ballroom's fans added",
    );
    expect(card.textContent).toContain("with Fort Street Ballroom's fans");
    // A venue whose tab shows its whole name keeps one line on every screen.
    fireEvent.click(actButton("Hollow Pines"));
    const other = screen.getByRole("region", { name: "Act card" });
    expect(other.querySelector(".card-venue-short")).toBeNull();
    expect(other.querySelector(".card-venue-full")!.textContent).toBe(
      "Climbs with The Lantern Room's fans added",
    );
  });

  it("closes its card", () => {
    open();
    fireEvent.click(actButton("Marisol Vey"));
    fireEvent.click(screen.getByRole("button", { name: "Close the card" }));
    expect(screen.queryByRole("region", { name: "Act card" })).toBeNull();
    expect(actButton("Marisol Vey").getAttribute("aria-expanded")).toBe(
      "false",
    );
    // Clicking the act's name again closes it too.
    fireEvent.click(actButton("Marisol Vey"));
    expect(screen.getByRole("region", { name: "Act card" })).toBeTruthy();
    fireEvent.click(actButton("Marisol Vey"));
    expect(screen.queryByRole("region", { name: "Act card" })).toBeNull();
  });

  it("is marked unavailable from its card, and the replacement takes its turn in its band by its climb", async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) =>
      url === "/api/refill"
        ? new Response(
            syntheticRefillStream(JSON.parse(String(init?.body)).unavailableId),
            NDJSON,
          )
        : // The venue switch reads the saved build's results on mount: not a refill.
          new Response(null, { status: 404 }),
    );
    vi.stubGlobal("fetch", fetch);
    open();
    // The tier lists its acts in the rule's order, the strongest Qloo match first (WS8).
    expect(midNames()).toEqual([
      "Hollow Pines",
      "Marisol Vey",
      "The Ditch Riders",
      "Kestrel & Bloom",
    ]);
    fireEvent.click(actButton("Hollow Pines"));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Act card" })).getByRole(
        "button",
        { name: "Unavailable" },
      ),
    );
    // M6e: the card asks why before it refills.
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "Why is it unavailable?" }),
      ).getByRole("button", { name: "Radius clause" }),
    );
    const refills = fetch.mock.calls.filter(([url]) => url === "/api/refill");
    expect(refills).toHaveLength(1);
    expect(refills[0][1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(refills[0][1]?.body))).toMatchObject({
      buildId: FIRST_BILL.build.id,
      unavailableId: acts[0].entityId,
      band: "mid",
      reason: "radius",
    });
    await waitFor(() => expect(actButton("Sego Lily")).toBeTruthy());
    // The replacement's place isn't in the build, but its climb is (its reason says up 13).
    expect(midNames()).toEqual([
      "Marisol Vey",
      "The Ditch Riders",
      "Kestrel & Bloom",
      "Sego Lily",
    ]);
    expect(screen.queryByRole("region", { name: "Act card" })).toBeNull();
  });
});
