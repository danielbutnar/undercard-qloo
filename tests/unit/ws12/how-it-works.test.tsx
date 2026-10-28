// @vitest-environment jsdom
// WS12 item 2: How it works as the director's cut of Watch, on the synthetic lineup (invented
// acts and venues): four full-width scenes made of the landing's own objects, Who does what as
// three backstage passes, What was tested as stamps (section 37 in Daniel's words; NOT SHOWN in
// words, never a dash). The act followed is the one that leads the build, never named in code.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MethodPage } from "@/components/method-page";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { syntheticVenueSwitch } from "../../e2e/synthetic-build";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const PLACES = {
  [acts[0].entityId]: { now: 3, was: 14 }, // the first mid-size act, up 11
  [acts[1].entityId]: { now: 6, was: 13 },
  [acts[2].entityId]: { now: 2, was: 28 },
  [acts[3].entityId]: { now: 9, was: 18 },
};
const story = methodStory(SAGEBRUSH_SOUND, { ...FIRST_BILL, places: PLACES })!;
const first = story.act;

function page() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/venue-switch")
        ? Response.json(syntheticVenueSwitch())
        : new Response(null, { status: 404 }),
    ),
  );
  render(<MethodPage story={story} videoUrl={null} />);
}
const scene = (n: number) =>
  screen.getByRole("region", { name: new RegExp(`^Scene ${n}: `) });

describe("How it works as the director's cut of Watch (WS12 item 2)", () => {
  it("plays four scenes, in Watch's order", () => {
    page();
    const titles = [1, 2, 3, 4].map((n) => scene(n).getAttribute("aria-label"));
    expect(titles).toEqual([
      "Scene 1: The headliners' fans alone",
      `Scene 2: + ${first.anchorVenue.name}'s fans`,
      "Scene 3: The door check",
      "Scene 4: Onto the poster",
    ]);
  });

  it("starts the act at its old place, near enough the column's top to see, the places between folded", () => {
    page();
    const ranking = within(scene(1)).getByRole("list", {
      name: `Qloo's ranking: ${first.name} 14th`,
    });
    const rows = within(ranking).getAllByRole("listitem");
    // The column is short: the top places, a fold, then the act's own neighbours.
    expect(rows.length).toBeLessThanOrEqual(10);
    expect(rows.some((row) => row.textContent === "…")).toBe(true);
    expect(rows.at(-2)?.textContent).toContain(first.name);
  });

  it("climbs with its venue's fans, and the venue's switch in the scene sends it back down", () => {
    page();
    const two = scene(2);
    expect(
      within(two).getByRole("list", {
        name: `Qloo's ranking: ${first.name} 3rd`,
      }),
    ).toBeTruthy();
    fireEvent.click(
      within(two).getByRole("button", {
        name: new RegExp(`^${first.anchorVenue.name}'s fans`),
      }),
    );
    expect(
      within(two).getByRole("list", {
        name: `Qloo's ranking: ${first.name} 14th`,
      }),
    ).toBeTruthy();
  });

  it("stamps the act's ticket at the door, and puts it on the poster", () => {
    page();
    expect(
      within(scene(3)).getByRole("article", { name: `${first.name}'s ticket` }),
    ).toBeTruthy();
    expect(
      within(scene(4)).getByRole("article", { name: first.name }),
    ).toBeTruthy();
  });

  it("shows who does what as three backstage passes", () => {
    page();
    const passes = within(
      screen.getByRole("region", { name: "Who does what" }),
    ).getAllByRole("listitem");
    expect(passes.map((pass) => pass.getAttribute("aria-label"))).toEqual([
      "The AI agent: plans the 12 Qloo calls",
      "Qloo: knows the taste",
      "The rule: picks the acts",
    ]);
  });

  it("stamps what was tested: section 37 shown in Daniel's words, and what isn't shown in words", () => {
    page();
    const tested = screen.getByRole("region", { name: "What was tested" });
    const stamps = within(tested).getAllByRole("listitem");
    expect(stamps[0].textContent).toContain(
      "244 of the 290 acts Undercard 1.0 booked climbed at least 5 places more with the town venue that put them on the bill than with a music room abroad of similar Qloo popularity.",
    );
    const not = stamps.at(-1)!;
    expect(not.textContent).toMatch(/^Not shown/);
    expect(not.querySelector(".verdict-number")?.textContent).toMatch(
      /[A-Za-z]{3}/,
    );
  });
});

describe("How it works tells a 2.0 build's rule from the saved act (Daniel, 2026-10-28)", () => {
  const lifted = methodStory(SAGEBRUSH_SOUND, {
    ...FIRST_BILL,
    places: PLACES,
    acts: FIRST_BILL.acts.map((entry, index) =>
      index === 0
        ? {
            ...entry,
            localLift: {
              venueClimb: 11,
              controlClimb: 4,
              control: {
                entityId: "c-1",
                name: "A Room Abroad",
                town: "Elsewhere",
              },
            },
          }
        : entry,
    ),
  })!;

  it("names the local lift over a room in the control's town with similar Qloo popularity", () => {
    render(<MethodPage story={lifted} videoUrl={null} />);
    expect(scene(3).textContent).toContain(
      "a local lift of 5 or more over a room in Elsewhere with similar Qloo popularity",
    );
    expect(
      screen.getByRole("region", { name: "Who does what" }).textContent,
    ).toContain("a local lift of 5 or more");
  });

  it("says nothing of a local lift on a 1.0 build, whose acts had none", () => {
    page();
    expect(scene(3).textContent).not.toContain("local lift");
    expect(
      screen.getByRole("region", { name: "Who does what" }).textContent,
    ).not.toContain("local lift");
  });
});
