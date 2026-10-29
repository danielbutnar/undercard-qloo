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
import { evidenceAnchor } from "@/lib/method";
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

  it("stamps what was tested in Daniel's words of 29 October: shown, partly shown, not shown", () => {
    page();
    const tested = screen.getByRole("region", { name: "What was tested" });
    const stamps = within(tested)
      .getAllByRole("listitem")
      .filter((item) => item.classList.contains("dc-verdict"));
    expect(
      stamps.map((stamp) => [
        stamp.querySelector(".dc-verdict-stamp")?.textContent,
        stamp.querySelector(".verdict-number")?.textContent,
      ]),
    ).toEqual([
      ["Shown", "244 of 290"],
      ["Partly shown", "20 of 30"],
      ["Not shown", "3 vs 11"],
    ]);
    expect(stamps[0].textContent).toContain(
      "244 of the 290 acts Undercard 1.0 booked climbed at least 5 places more with the town venue that put them on the bill than with a music venue abroad of similar Qloo popularity.",
    );
    const not = stamps[2];
    expect(not.querySelector(".dc-verdict-line")?.textContent).toBe(
      "At 33 real festivals, Undercard's shortlists held 3 of the acts the festivals actually booked; the AI model alone held 11. Neither test bar was met.",
    );
    // Under "How we tested", word for word.
    const how = not.querySelector("details")!;
    expect(how.querySelector("summary")?.textContent).toBe("How we tested");
    expect(how.textContent).toContain(
      "All three shortlists had the same headliners and the same brief, and a hit is any act on the festival's lineup except its headliners. 6 of the model's 11 hits are acts outside the fee bands Undercard is given. Counting only the booked acts inside those bands: Undercard 3, the model 2, Undercard with another country's venues 1. The model may also recall real lineups from its training. Against Undercard with another country's venues, Undercard won 3 festivals to 2, which doesn't meet that bar either.",
    );
    // Each stamp links its section of docs/evidence.md.
    expect(
      stamps.map(
        (stamp) =>
          within(stamp).getByRole("link").getAttribute("href")?.split("#")[1],
      ),
    ).toEqual([
      evidenceAnchor(
        "37. The control test across the 29 towns, written before any call",
      ),
      evidenceAnchor(
        "34. Two controls for the premise test, written before any call",
      ),
      evidenceAnchor(
        "38. An outside yardstick at real festivals, written before any call",
      ),
    ]);
  });

  it("keeps the 29 towns' line out of the stamps, in the method fold", () => {
    page();
    const tested = screen.getByRole("region", { name: "What was tested" });
    const fold = tested.querySelector("details.dc-method")!;
    expect(fold.querySelector("summary")?.textContent).toBe("The method");
    expect(fold.textContent).toMatch(/^The methodAcross 29 towns, /);
    for (const stamp of tested.querySelectorAll(".dc-verdict"))
      expect(stamp.textContent).not.toContain("Across 29 towns");
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

  it("names the local lift over a venue in the control's town with similar Qloo popularity", () => {
    render(<MethodPage story={lifted} videoUrl={null} />);
    expect(scene(3).textContent).toContain(
      "a local lift of 5 or more over a venue in Elsewhere with similar Qloo popularity",
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
