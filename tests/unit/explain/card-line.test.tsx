// @vitest-environment jsdom
// WS7 part (b), step 3: an act's card carries one small line on Qloo's split, from the first
// bill (the server's cache-only read), after the rule that fills a slot and outside the three
// checks, so it never reads as a check that backs the venue the card credits. It shows only for
// an act on the saved lineup with every venue on. Invented acts, venues and lines.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CARD_STRONGEST } from "@/components/chart/poster-words";
import { FestivalScreen } from "@/components/festival-screen";
import type { SplitLine } from "@/lib/attribution-line";
import type { FirstBill } from "@/lib/first-bill";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { syntheticVenueSwitch } from "../../e2e/synthetic-build";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const idOf = (name: string) => acts.find((act) => act.name === name)!.entityId;

// Marisol Vey's card credits Fort Street Ballroom; this invented split leans to the other venue.
const MARISOL: SplitLine = {
  line: "With this fee range's venues together, Qloo traces 51% of this act's match to fans of the headliners, 30% to fans of The Lantern Room and 19% to fans of Fort Street Ballroom.",
  short:
    "With this fee range's venues together, Qloo traces 51% of this act's match to fans of the headliners, 30% to fans of The Lantern Room and 19% to fans of FSB.",
};
const ONE_FORM: SplitLine = {
  line: "Qloo traces 62% of this act's match to fans of the headliners and 38% to fans of The Lantern Room.",
  short:
    "Qloo traces 62% of this act's match to fans of the headliners and 38% to fans of The Lantern Room.",
};

const BILL: FirstBill = {
  ...FIRST_BILL,
  venueSwitch: { ...syntheticVenueSwitch(), buildId: FIRST_BILL.build.id },
  splits: {
    [idOf("Marisol Vey")]: MARISOL,
    [idOf("Low Bench Choir")]: ONE_FORM,
  },
};

function renderScreen(bill: FirstBill = BILL) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={bill} />);
}

function openCard(name: string) {
  fireEvent.click(
    within(screen.getByRole("region", { name: "Undercard draft" })).getByRole(
      "button",
      { name },
    ),
  );
  return within(screen.getByRole("region", { name: "Act card" })).getByRole(
    "article",
    { name },
  );
}

describe("the act card's line on Qloo's split (WS7 part b)", () => {
  it("shows the server's line after the rule that fills a slot, outside the three checks", () => {
    renderScreen();
    const card = openCard("Marisol Vey");
    const line = card.querySelector(".card-split");
    expect(line).not.toBeNull();
    expect(card.querySelector(".card-split-full")!.textContent).toBe(
      MARISOL.line,
    );
    expect(card.querySelector(".card-split-short")!.textContent).toBe(
      MARISOL.short,
    );
    expect(
      within(card).getByRole("list", { name: "The three checks it passed" })
        .textContent,
    ).not.toContain("Qloo traces");
    const rule = within(card).getByText(CARD_STRONGEST);
    expect(
      rule.compareDocumentPosition(line!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps one form when the phone's would be the same", () => {
    renderScreen();
    const card = openCard("Low Bench Choir");
    expect(card.querySelector(".card-split-full")!.textContent).toBe(
      ONE_FORM.line,
    );
    expect(card.querySelector(".card-split-short")).toBeNull();
  });

  it("shows no line for an act the first bill gives none", () => {
    renderScreen();
    const other = acts.find(
      (act) => !(act.entityId in (BILL.splits ?? {})),
    )!.name;
    expect(openCard(other).querySelector(".card-split")).toBeNull();
  });

  it("drops the line while a venue is off, and brings it back with every venue on", () => {
    renderScreen();
    const toggle = (state: "on" | "off") =>
      screen
        .getAllByRole("button")
        .find((button) =>
          button
            .getAttribute("aria-label")
            ?.startsWith(`Cottonwood Social Hall's fans: ${state}`),
        )!;
    // Cottonwood Social Hall lifts no act: every act stays, but the lineup is a what-if.
    fireEvent.click(toggle("on"));
    const card = openCard("Marisol Vey");
    expect(card.querySelector(".card-split")).toBeNull();
    expect(card.textContent).toContain(
      "Turn every venue back on to keep or replace acts.",
    );
    fireEvent.click(toggle("off"));
    expect(
      openCard("Marisol Vey").querySelector(".card-split-full")!.textContent,
    ).toBe(MARISOL.line);
  });

  it("shows no line without the first bill's splits", () => {
    renderScreen({ ...BILL, splits: undefined });
    expect(openCard("Marisol Vey").querySelector(".card-split")).toBeNull();
  });
});
