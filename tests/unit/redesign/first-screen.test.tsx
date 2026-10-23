// @vitest-environment jsdom
// WS9, step 4: the first screen as the layout brief draws it ("Your town prints your poster"):
// the lead and the town picker, Watch, the poster (its key of venue switches, its acts as names
// in their venues' colours with their climbs, the example line, the actions) and the town, its
// venues standing in the build's order with a sign each. Synthetic build, invented names.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syntheticVenueSwitch } from "../../e2e/synthetic-build";
import { TownScene } from "@/components/chart/town-scene";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

// jsdom lays nothing out: give every element a laptop scene's size, so the town measures itself.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 820,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 560,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
});

const withSwitch = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/venue-switch")
        ? Response.json(syntheticVenueSwitch())
        : new Response(null, { status: 404 }),
    ),
  );
const open = (towns?: string[]) =>
  render(
    <FestivalScreen
      festival={SAGEBRUSH_SOUND}
      firstBill={FIRST_BILL}
      towns={towns}
    />,
  );
const poster = () => screen.getByRole("region", { name: "Undercard draft" });
const town = () => screen.getByRole("region", { name: "Your town" });

describe("the lead", () => {
  it("picks a town in one click, each by its name, with Your town after them", () => {
    withSwitch();
    open(["boise", "austin", "denver", "nashville"]);
    const nav = screen.getByRole("navigation", {
      name: "Same brief, other towns",
    });
    const links = within(within(nav).getByRole("list")).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Boise ID",
      "Austin TX",
      "Denver CO",
      "Nashville TN",
    ]);
    // Named by the town alone; the state's code is for the eye.
    expect(within(nav).getByRole("link", { name: "Boise" })).toHaveProperty(
      "ariaCurrent",
      "page",
    );
    expect(
      within(nav).getByRole("link", { name: "Austin" }).getAttribute("href"),
    ).toBe("/towns/austin");
    expect(
      within(nav).getByRole("link", { name: "Your town" }).getAttribute("href"),
    ).toBe("/your-festival");
  });

  it("says under Watch what it replays", () => {
    withSwitch();
    open();
    expect(document.querySelector(".watch-sub")!.textContent).toBe(
      "Replays how the agent drafted Boise",
    );
  });
});

describe("the poster", () => {
  it("keys each venue the build read, each a switch for its fans once the switch is in", async () => {
    withSwitch();
    open();
    const key = within(poster()).getByRole("group", {
      name: "Venue fans used for this draft",
    });
    expect(within(key).getByText("Drafted by Undercard")).toBeTruthy();
    const lantern = await within(key).findByRole("button", {
      name: "The Lantern Room's fans: on, 7 acts. Switch them off",
    });
    expect(lantern.getAttribute("aria-pressed")).toBe("true");
    expect(
      within(key).getByRole("button", {
        name: "Cottonwood Social Hall's fans: on, 0 acts. Switch them off",
      }),
    ).toBeTruthy();
    // Off, the poster re-forms from the saved build: The Lantern Room's acts leave it.
    fireEvent.click(lantern);
    expect(
      within(key).getByRole("button", {
        name: "The Lantern Room's fans: off. Switch them on",
      }),
    ).toHaveProperty("ariaPressed", "false");
    expect(within(poster()).getAllByRole("article")).toHaveLength(3);
    // The switch below the fold says the same.
    expect(
      screen.getByRole("button", {
        name: "The Lantern Room: off, lifted none",
      }),
    ).toBeTruthy();
  });

  it("names the first act's climb in one sentence, with what to try next", async () => {
    withSwitch();
    open();
    const example = poster().querySelector(".poster-example")!;
    await waitFor(() =>
      expect(example.textContent).toMatch(/switch a venue off above\.$/),
    );
    expect(example.textContent).toMatch(
      /^THE LANTERN ROOM ↑11|^The Lantern Room ↑11/i,
    );
    expect(example.textContent).toContain(
      // The poster's first act in the rule's order (WS8).
      "Hollow Pines climbed from 12th to 1st in Qloo's ranking once The Lantern Room's fans joined the headliners' fans.",
    );
  });

  // WS8: each tier lists its acts in the rule's order (the strongest Qloo match first), each with
  // its place in its venue's ranking beside the climb.
  it("lists each tier in the rule's order, with the rank beside the climb (WS8)", async () => {
    withSwitch();
    open();
    const mid = within(poster()).getByRole("region", { name: "Mid-size acts" });
    const acts = within(mid).getAllByRole("article");
    expect(acts.map((act) => act.getAttribute("aria-label"))).toEqual(
      FIRST_BILL.acts
        .filter((act) => act.band === "mid")
        .sort((a, b) => b.affinity - a.affinity)
        .map((act) => act.name),
    );
    for (const act of acts)
      await waitFor(() =>
        expect(act.querySelector(".poster-climb")?.textContent).toMatch(
          /^\d+(st|nd|rd|th) (↑\d+|NEW)$/,
        ),
      );
  });

  it("keeps a band's acts and says why the other band's slots stay open when its venue is off (WS8)", async () => {
    // As Boise with V418 off: the mid-size acts stay, and no opener clears the bar.
    const data = syntheticVenueSwitch();
    const mid = Object.keys(data.entries).filter(
      (key) => data.entries[key].act.band === "mid",
    );
    data.lineups["011"] = { keys: mid, shortfall: { mid: 0, opener: 6 } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(data)),
    );
    open();
    const key = within(poster()).getByRole("group", {
      name: "Venue fans used for this draft",
    });
    fireEvent.click(
      await within(key).findByRole("button", {
        name: /^The Lantern Room's fans: on/,
      }),
    );
    const band = (name: string) =>
      within(poster()).getByRole("region", { name });
    expect(within(band("Mid-size acts")).getAllByRole("article")).toHaveLength(
      4,
    );
    const openers = band("Opening acts");
    expect(within(openers).queryAllByRole("article")).toHaveLength(0);
    expect(openers.querySelectorAll(".poster-slot")).toHaveLength(0);
    // The venues the draft read for opening acts (the saved build's anchors), and the one off.
    expect(within(openers).getByRole("status").textContent).toBe(
      "The 6 opening slots stay open. For opening acts this draft read The Lantern Room's and Fort Street Ballroom's fans. With The Lantern Room off, no act passes the rule for these slots.Switch The Lantern Room back on",
    );
    fireEvent.click(
      within(openers).getByRole("button", {
        name: "Switch The Lantern Room back on",
      }),
    );
    expect(within(poster()).getAllByRole("article")).toHaveLength(10);
  });

  it("says why every slot stays open with every venue switched off, and brings them back", async () => {
    withSwitch();
    open();
    const key = within(poster()).getByRole("group", {
      name: "Venue fans used for this draft",
    });
    for (const name of [
      "The Lantern Room",
      "Fort Street Ballroom",
      "Cottonwood Social Hall",
    ])
      fireEvent.click(
        await within(key).findByRole("button", {
          name: new RegExp(`^${name}'s fans: on`),
        }),
      );
    expect(within(poster()).queryAllByRole("article")).toHaveLength(0);
    const open10 = within(poster())
      .getByText(/^All 10 slots stay open\./)
      .closest<HTMLElement>("[role=status]")!;
    expect(open10.textContent).toContain(
      "All 10 slots stay open. Every venue's fans are off, so no act rises 5 places.",
    );
    fireEvent.click(
      within(open10).getByRole("button", {
        name: "Switch every venue back on",
      }),
    );
    expect(within(poster()).getAllByRole("article")).toHaveLength(10);
  });
});

describe("the town", () => {
  it("explains its colours with the places Qloo listed, and signs each venue with its acts", async () => {
    withSwitch();
    open();
    expect(
      within(town()).getByText(
        /^Qloo found 8 live-music venues in Boise; the AI agent tested these 3\. Coloured: their fans lifted acts onto your poster\. Grey: none of their acts are on your poster\.$/,
      ),
    ).toBeTruthy();
    const signs = await within(town()).findAllByRole("button", {
      name: /\. Show this venue$/,
    });
    expect(signs.map((sign) => sign.getAttribute("aria-label")).sort()).toEqual(
      [
        "Cottonwood Social Hall, none. Show this venue",
        "Fort Street Ballroom, 3 acts. Show this venue",
        "The Lantern Room, 7 acts. Show this venue",
      ],
    );
    expect(
      within(town()).getByRole("group", { name: "Move around the town" }),
    ).toBeTruthy();
  });

  it("opens a venue's card from its sign: its acts on the poster and its switch", async () => {
    withSwitch();
    open();
    fireEvent.click(
      await within(town()).findByRole("button", {
        name: "Fort Street Ballroom, 3 acts. Show this venue",
      }),
    );
    const card = screen.getByRole("region", { name: "Fort Street Ballroom" });
    expect(card.textContent).toContain(
      "Fort Street Ballroom's fans lifted 3 acts onto your poster. Pick one for why.",
    );
    expect(
      within(
        within(card).getByRole("list", { name: "Acts its fans lifted" }),
      ).getAllByRole("button"),
    ).toHaveLength(3);
    // The poster says so too, and fades the other venues' acts.
    expect(poster().querySelector(".poster-example")!.textContent).toContain(
      "Fort Street Ballroom's fans lifted 3 acts onto your poster.",
    );
    expect(poster().querySelectorAll(".poster-act.is-dim")).toHaveLength(7);
    fireEvent.click(within(card).getByRole("button", { name: "Close" }));
    expect(
      screen.queryByRole("region", { name: "Fort Street Ballroom" }),
    ).toBeNull();
  });
});

describe("the town scene on its own", () => {
  const venues = [
    {
      entityId: "a",
      name: "First Hall (FH)",
      hue: 0,
      lifted: 4,
      off: false,
      unread: false,
    },
    {
      entityId: "b",
      name: "Second Room",
      hue: null,
      lifted: 0,
      off: false,
      unread: false,
    },
    {
      entityId: "c",
      name: "Third Stage",
      hue: 1,
      lifted: 2,
      off: true,
      unread: false,
    },
  ];

  it("signs each venue without its bracketed note, and says why one has no acts", () => {
    render(
      <TownScene
        seedKey="test-town"
        venues={venues}
        selected={null}
        focusOn={null}
      />,
    );
    const names = [...document.querySelectorAll(".town-sign-name")].map(
      (name) => name.textContent,
    );
    expect(names.sort()).toEqual(["First Hall", "Second Room", "Third Stage"]);
    const chips = Object.fromEntries(
      [...document.querySelectorAll(".town-sign")].map((sign) => [
        sign.querySelector(".town-sign-name")!.textContent,
        sign.querySelector(".town-sign-chip")!.textContent,
      ]),
    );
    expect(chips).toEqual({
      "First Hall": "4 acts",
      "Second Room": "none",
      "Third Stage": "Fans off",
    });
    // One building per venue, lit in its colour, grey, or grey with its fans off.
    expect(document.querySelectorAll(".town-box-lit.venue-0")).toHaveLength(1);
    expect(document.querySelectorAll(".town-box-dark")).toHaveLength(2);
  });

  it("marks the venues Watch hasn't read yet, and stands pale with no signs without Qloo", () => {
    const { rerender } = render(
      <TownScene
        seedKey="test-town"
        venues={venues.map((venue) => ({ ...venue, unread: true }))}
        selected={null}
        focusOn={null}
        dim
      />,
    );
    expect(
      [...document.querySelectorAll(".town-sign-chip")].map(
        (chip) => chip.textContent,
      ),
    ).toEqual(["not read yet", "not read yet", "not read yet"]);
    expect(document.querySelectorAll(".town-box-unread")).toHaveLength(3);
    rerender(
      <TownScene
        seedKey="test-town"
        venues={venues}
        selected={null}
        focusOn={null}
        without
      />,
    );
    expect(document.querySelectorAll(".town-sign")).toHaveLength(0);
    expect(document.querySelectorAll(".town-box-ghost")).toHaveLength(3);
    expect(document.querySelector(".town-view.is-without")).not.toBeNull();
  });

  it("keeps signs out from under what the screen sets over it, and gives a card the controls' corner", () => {
    const { rerender } = render(
      <TownScene
        seedKey="test-town"
        venues={venues}
        selected={null}
        focusOn={null}
      />,
    );
    expect(document.querySelectorAll(".town-sign")).toHaveLength(3);
    // A band over the whole town: no sign can show under it.
    rerender(
      <TownScene
        seedKey="test-town"
        venues={venues}
        selected={null}
        focusOn={null}
        reserve={{ top: 560 }}
      />,
    );
    expect(document.querySelectorAll(".town-sign")).toHaveLength(0);
    expect(
      screen.getByRole("group", { name: "Move around the town" }),
    ).toBeTruthy();
    rerender(
      <TownScene
        seedKey="test-town"
        venues={venues}
        selected={null}
        focusOn={null}
        reserve={{ right: 404 }}
      />,
    );
    expect(
      screen.queryByRole("group", { name: "Move around the town" }),
    ).toBeNull();
  });

  it("picks a venue from its sign, and the whole town again from the controls", () => {
    const pick = vi.fn();
    render(
      <TownScene
        seedKey="test-town"
        venues={venues}
        selected="a"
        focusOn="a"
        onPick={pick}
      />,
    );
    const sign = screen.getByRole("button", {
      name: "Second Room, none. Show this venue",
    });
    fireEvent.click(sign);
    expect(pick).toHaveBeenLastCalledWith("b");
    // The picked venue's sign is pressed; a second click on it lets it go.
    fireEvent.click(
      screen.getByRole("button", {
        name: "First Hall (FH), 4 acts. Show this venue",
      }),
    );
    expect(pick).toHaveBeenLastCalledWith(null);
    fireEvent.click(
      screen.getByRole("button", { name: "Show the whole town" }),
    );
    expect(pick).toHaveBeenLastCalledWith(null);
    for (const name of [
      "Turn the town left",
      "Turn the town right",
      "Zoom in",
      "Zoom out",
    ])
      expect(screen.getByRole("button", { name })).toBeTruthy();
  });
});
