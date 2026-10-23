// @vitest-environment jsdom
// M10b: How it works, rebuilt (docs/evidence.md section 28), on the synthetic lineup.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
  // A step's link stays in the address between tests (/method?step=N).
  window.history.replaceState(null, "", "/");
});

const PLACES = {
  [acts[0].entityId]: { now: 3, was: 14 }, // Hollow Pines, up 11
  [acts[1].entityId]: { now: 6, was: 13 }, // Marisol Vey, up 7
  [acts[2].entityId]: { now: 2, was: 28 }, // The Ditch Riders, up 26
  [acts[3].entityId]: { now: 9, was: 18 }, // Kestrel & Bloom, up 9
};
const story = methodStory(SAGEBRUSH_SOUND, { ...FIRST_BILL, places: PLACES })!;

// The venue switch reads the saved build's results on mount; the synthetic switch drops a
// venue's acts when it's off.
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

const region = (name: string) => screen.getByRole("region", { name });
const follows = (a: HTMLElement, b: HTMLElement) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("How it works, top to bottom (M10b)", () => {
  // WS2: the video's slot leads only once the video is published (tests/unit/method).
  it("runs the picture, one act, try it, who does what, then what was tested", () => {
    page();
    expect(screen.queryByRole("region", { name: "The demo video" })).toBeNull();
    const order = [
      "The method in one picture",
      "Follow one act",
      "Try it",
      "Who does what",
      "What was tested",
    ].map(region);
    order
      .slice(1)
      .forEach((next, i) => expect(follows(order[i], next)).toBe(true));
    // The evidence and the objections live on their own page now, linked from this one.
    expect(screen.queryByRole("table")).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Five objections" }),
    ).toBeNull();
    expect(
      within(region("What was tested"))
        .getByRole("link", { name: /The evidence/ })
        .getAttribute("href"),
    ).toBe("/method/evidence");
  });

  it("draws the method as four small cards, named as one picture", () => {
    page();
    const picture = within(region("The method in one picture")).getByRole(
      "img",
      {
        name: /How Undercard drafts a lineup/,
      },
    );
    expect(picture.querySelectorAll(".how-card")).toHaveLength(4);
  });

  it("keeps the three-line summary: shown, partly shown, not shown", () => {
    page();
    const items = within(region("What was tested")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent!.split(":")[0])).toEqual([
      "Shown",
      "Partly shown",
      "Not shown",
    ]);
  });
});

describe("following one act through the saved build", () => {
  const row = () =>
    within(region("Follow one act")).getAllByRole("article", {
      name: "Hollow Pines",
    })[0];
  const next = () =>
    fireEvent.click(
      within(region("Follow one act")).getByRole("button", {
        name: "Next step",
      }),
    );

  it("starts at its place for the headliners' fans alone, with no venue yet", () => {
    page();
    expect(row().querySelector(".row-place")!.textContent).toBe("14");
    expect(row().querySelector(".row-venue-none")).not.toBeNull();
    expect(region("Follow one act").textContent).toMatch(
      /Khruangbin and Japanese Breakfast/,
    );
  });

  it("adds its venue's fans: the climb, its ladder and the venue tab, as on the first screen", () => {
    page();
    next();
    expect(row().querySelector(".row-place")!.textContent).toBe("11");
    expect(row().querySelector(".row-place svg.tri")).not.toBeNull();
    expect(row().querySelector(".ladder")!.textContent).toBe("14th3rd");
    expect(row().querySelector(".row-venue")!.textContent).toBe(
      "The Lantern Room",
    );
  });

  it("checks it against the rule, then puts it on the lineup", () => {
    page();
    next();
    next();
    const checks = within(
      within(region("Follow one act")).getByRole("list", {
        name: "The rule's checks",
      }),
    ).getAllByRole("listitem");
    expect(checks.map((check) => check.textContent)).toEqual([
      expect.stringMatching(/^Climbs 5 places or more in Qloo's ranking: 11/),
      expect.stringMatching(
        // Popularity on the tier's own scale, as the act card and the tier captions give it.
        /^Inside the tier's popularity range \(80–92\): \d+$/,
      ),
      "Shares two genres with the headliners: Dream Pop, Psychedelic Rock",
    ]);
    next();
    const lineup = within(region("Follow one act")).getByRole("region", {
      name: "Mid-size acts",
    });
    expect(within(lineup).getAllByRole("article")).toHaveLength(4);
    expect(
      within(lineup).getByRole("article", { name: "Hollow Pines" }).className,
    ).toContain("is-open");
    // There is no step after the lineup.
    expect(
      within(region("Follow one act")).getByRole("button", {
        name: "Next step",
      }),
    ).toHaveProperty("disabled", true);
  });

  it("shows the AI agent's choices: the venues it read and the one whose fans lifted no act", () => {
    page();
    const choices = within(region("Follow one act")).getByRole("region", {
      name: "The AI agent's choices",
    });
    expect(choices.textContent).toMatch(/Qloo listed 8 live-music places/);
    const venues = within(choices).getAllByRole("listitem");
    expect(venues.map((venue) => venue.textContent)).toEqual([
      "The Lantern Room7 acts lifted",
      "Fort Street Ballroom3 acts lifted",
      "Cottonwood Social Halllifted none",
    ]);
  });
});

describe("trying it", () => {
  it("switches the act's venue off, and the acts its fans lifted leave the lineup", async () => {
    page();
    const tryIt = region("Try it");
    const toggle = await within(tryIt).findByRole("switch", {
      name: "The Lantern Room's fans",
    });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(
      within(tryIt).getByRole("article", { name: "Hollow Pines" }),
    ).toBeTruthy();
    // Daniel's brief of 2026-10-22 (second batch, item 1): Undercard drafts, as on the first screen.
    expect(
      within(tryIt).getByText(
        "Every venue on: the lineup as Undercard drafted it.",
      ),
    ).toBeTruthy();
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(
        within(tryIt).queryByRole("article", { name: "Hollow Pines" }),
      ).toBeNull(),
    );
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(tryIt.textContent).toMatch(
      /Without The Lantern Room's fans, .*Hollow Pines.* leave/,
    );
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(
        within(tryIt).getByRole("article", { name: "Hollow Pines" }),
      ).toBeTruthy(),
    );
  });
});

describe("who does what", () => {
  it("is three cards of one line each", () => {
    page();
    const cards = within(region("Who does what")).getAllByRole("listitem");
    expect(cards.map((card) => card.textContent)).toEqual([
      "The AI agentplans the 12 Qloo calls",
      "Qlooknows the taste",
      "The app's rulepicks the acts",
    ]);
  });
});
