// @vitest-environment jsdom
// WS9 (the layout brief's act card): an act's card leads with its slot and the venue whose fans
// lifted it, then "Why it's on your poster" as the three checks it passed (the climb, the fee
// range, the two genres), each with Qloo's own numbers, then the rule that fills a slot; Keep,
// Unavailable and Close stay. Invented acts and venues.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const idOf = (name: string) => acts.find((act) => act.name === name)!.entityId;
const BILL = {
  ...FIRST_BILL,
  places: {
    [idOf("Marisol Vey")]: { now: 4, was: 11 },
    [idOf("Low Bench Choir")]: { now: 8, was: null },
  },
};

function openCard(name: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={BILL} />);
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

describe("an act's card", () => {
  it("leads with its slot and its venue's fans, then the three checks it passed", () => {
    const card = openCard("Marisol Vey");
    expect(within(card).getByText("Mid-size act")).toBeTruthy();
    expect(card.querySelector(".card-venue-full")!.textContent).toBe(
      "Climbs with Fort Street Ballroom's fans added",
    );
    expect(within(card).getByText("Why it's on your poster")).toBeTruthy();
    const checks = within(card)
      .getByRole("list", { name: "The three checks it passed" })
      .querySelectorAll(":scope > li");
    expect(checks).toHaveLength(3);
    // The climb, with its places and the rule's bar.
    expect(checks[0].textContent).toContain("Its place in Qloo's ranking");
    expect(checks[0].textContent).toContain(
      "Why it's here: With Fort Street Ballroom's fans added to the headliners', Qloo ranks Marisol Vey 4th; for the headliners' fans alone, 11th. That climb of 7 is why Marisol Vey is here.",
    );
    expect(checks[0].textContent).toContain(
      "Undercard only books a climb of 5 places or more.",
    );
    // The fee range, with Qloo's numbers.
    expect(checks[1].textContent).toContain(
      "Its Qloo popularity is inside the mid-size range, 80–92 out of 100, our stand-in for fee.",
    );
    expect(
      within(checks[1] as HTMLElement).getByText("Qloo affinity").parentElement
        ?.textContent,
    ).toBe("Qloo affinity0.91");
    expect(
      within(checks[1] as HTMLElement).getByText("Popularity").parentElement
        ?.textContent,
    ).toBe("Popularity88");
    // The two genres it shares with the headliners.
    expect(checks[2].textContent).toContain(
      "It shares two genres with the headliners:",
    );
    expect(
      within(checks[2] as HTMLElement)
        .getByRole("list", { name: "Tags shared with the headliners" })
        .querySelectorAll("li"),
    ).toHaveLength(2);
    expect(
      within(card).getByText(
        "Of the acts that pass all three, the strongest Qloo match fills each slot first.",
      ),
    ).toBeTruthy();
    // Each check is ticked in the venue's colour.
    expect(card.querySelectorAll(".card-tick")).toHaveLength(3);
  });

  it("keeps Keep, Unavailable and Close", () => {
    const card = openCard("Marisol Vey");
    expect(within(card).getByRole("button", { name: "Keep" })).toBeTruthy();
    expect(
      within(card).getByRole("button", { name: "Unavailable" }),
    ).toBeTruthy();
    expect(
      within(card).getByRole("button", { name: "Close the card" }),
    ).toBeTruthy();
  });

  it("calls an opener an opening act, and a new entry's climb into the top 50", () => {
    const card = openCard("Low Bench Choir");
    expect(within(card).getByText("Opening act")).toBeTruthy();
    expect(card.textContent).toContain(
      "Its Qloo popularity is inside the opening range, 55–80 out of 100, our stand-in for fee.",
    );
    expect(card.textContent).toMatch(
      /Why it's here: With The Lantern Room's fans added to the headliners', Qloo ranks Low Bench Choir 8th; for the headliners' fans alone, it isn't in the top 50\./,
    );
  });
});
