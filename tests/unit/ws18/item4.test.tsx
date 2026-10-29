// @vitest-environment jsdom
// WS18 item 4 (Daniel, 29 October, 15:00): "check any list" as the second job. Without Qloo
// gets one line under its dot chart, with N counted from the town's saved answer, and a button
// that opens the pitch check on the model's picks; the pitch check is in every page's nav under
// one name, "Check a shortlist"; its venue colours are the landing's; and it says what its ▲
// counts. Invented acts and venues.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIMB_KEY } from "@/components/shortlist/words";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodPage } from "@/components/method-page";
import { MethodEvidencePage } from "@/components/method-evidence";
import { ShortlistScreen } from "@/components/shortlist/shortlist-screen";
import { YourFestival } from "@/components/your-festival";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { shortlistFromSearch, shortlistHref } from "@/lib/shortlist";
import { checkedFestival } from "@/lib/towns";
import { venueHues } from "@/lib/venue-colours";
import { anchorVenues, callBudget, checkShortlist } from "@/server/shortlist";
import {
  syntheticLlmOnly,
  syntheticVenueSwitch,
} from "../../e2e/synthetic-build";
import { qlooWorld, savedBuild, shortlistQloo } from "../shortlist/world";
import { TWO_BILL } from "./two-bill";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const { lineup } = syntheticLlmOnly();
const NAMES = lineup.picks.map((pick) => pick.name);
// Four of the ten picks above both ranges, four inside one, one below, one not found.
const CHECKS = lineup.picks.map((pick, n) =>
  n === 9
    ? { name: pick.name, status: "not-found" as const }
    : {
        name: pick.name,
        status: "found" as const,
        popularity: n < 4 ? 0.95 : n < 8 ? 0.7 : 0.4,
        range: n < 4 ? "above" : n < 8 ? "in" : "below",
        genres: 2,
        climb: null,
      },
);

async function withoutQloo(festival = SAGEBRUSH_SOUND) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/venue-switch")
        ? Response.json(syntheticVenueSwitch())
        : Response.json({ lineup, cached: true, checks: CHECKS }),
    ),
  );
  render(<FestivalScreen festival={festival} firstBill={TWO_BILL} />);
  fireEvent.click(screen.getByRole("button", { name: /^Without Qloo/ }));
  return screen.findByRole("link", { name: "Check its picks on Qloo →" });
}

describe("Without Qloo, the second job (WS18 item 4)", () => {
  it("says under the dot chart what the model's picks miss, N counted from the town's answer", async () => {
    await withoutQloo();
    const line = screen.getByText(/^At 33 real festivals/);
    expect(line.textContent).toBe(
      "At 33 real festivals, the model alone named more of the acts the festivals booked than Undercard did, 11 to 3 (section 38). It can't read Boise's venue fans, and 4 of these 10 picks sit above the popularity range that stands in for the fee.",
    );
    // Under the dot chart: after it in the page's order.
    const chart = document.querySelector(".ruler")!;
    expect(
      chart.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens the pitch check on the model's picks, for the same town, without running it", async () => {
    const link = await withoutQloo();
    const href = link.getAttribute("href")!;
    expect(href).toBe(
      shortlistHref({ festivalId: SAGEBRUSH_SOUND.id, names: NAMES }),
    );
    expect(shortlistFromSearch(href.split("?")[1])).toEqual({
      festivalId: SAGEBRUSH_SOUND.id,
      names: NAMES,
    });
  });

  it("fills the pitch check from such a link, and nothing runs until the button", () => {
    const austin = checkedFestival(
      CHECKED_TOWNS.find((town) => town.city === "Austin")!,
    );
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    // The page reads the link on the server and hands it to the screen.
    const href = shortlistHref({
      festivalId: austin.id,
      names: ["Night Orchard", "Dusk Arcade"],
    });
    render(<ShortlistScreen linked={shortlistFromSearch(href.split("?")[1])} />);
    expect(
      (screen.getByRole("combobox", { name: "Town" }) as HTMLSelectElement)
        .value,
    ).toBe(austin.id);
    expect(
      (
        screen.getByRole("textbox", {
          name: /acts you've been pitched/i,
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("Night Orchard\nDusk Arcade");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reads only a checked town and at most ten names from a link", () => {
    expect(shortlistFromSearch("town=nowhere&act=A")).toBeNull();
    const many = Array.from({ length: 14 }, (_, n) => `Act ${n}`);
    expect(
      shortlistFromSearch(
        shortlistHref({ festivalId: SAGEBRUSH_SOUND.id, names: many }).split(
          "?",
        )[1],
      )?.names,
    ).toHaveLength(10);
  });
});

describe("the pitch check in every page's nav, under one name", () => {
  const quiet = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
  const navLink = () =>
    within(screen.getByRole("navigation", { name: "Other screens" })).getByRole(
      "link",
      { name: "Check a shortlist" },
    );

  it("is on the landing, How it works, the evidence page and Your festival", () => {
    for (const page of [
      <FestivalScreen
        key="landing"
        festival={SAGEBRUSH_SOUND}
        firstBill={TWO_BILL}
      />,
      <MethodPage
        key="how"
        story={methodStory(SAGEBRUSH_SOUND, TWO_BILL)!}
        videoUrl={null}
      />,
      <MethodEvidencePage key="evidence" />,
      <YourFestival key="yours" />,
    ]) {
      quiet();
      render(page);
      expect(navLink().getAttribute("href")).toBe("/shortlist");
      cleanup();
    }
  });

  it("goes by that name in the links that lead to it, never another", () => {
    quiet();
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={TWO_BILL} />);
    expect(document.body.textContent).not.toContain(
      "Check the acts you've been pitched",
    );
    cleanup();
    render(
      <MethodPage
        story={methodStory(SAGEBRUSH_SOUND, TWO_BILL)!}
        videoUrl={null}
      />,
    );
    expect(document.body.textContent).not.toContain(
      "Check the acts you've been pitched",
    );
    expect(
      screen
        .getAllByRole("link", { name: /^Check a shortlist/ })
        .every((link) => link.getAttribute("href") === "/shortlist"),
    ).toBe(true);
  });
});

describe("the pitch check's own words", () => {
  it("colours each venue as the landing does for the same build", async () => {
    const build = savedBuild();
    const world = qlooWorld(shortlistQloo());
    const shortlist = await checkShortlist({
      festival: SAGEBRUSH_SOUND,
      build,
      names: ["Marigold Static", "Velvet Coyote"],
      budget: callBudget({ ...world, cap: 14 }),
    });
    // The landing: its venues in the saved build's order, coloured by the saved lineup.
    const landing = venueHues(anchorVenues(build.context), build.lineup.acts);
    for (const venue of shortlist.venues)
      if (venue.hue !== null)
        expect([venue.name, venue.hue]).toEqual([
          venue.name,
          landing.get(venue.entityId),
        ]);
  });

  it("says what its ▲ counts: places among the pasted acts, not Qloo's top 50, with no venue abroad read", () => {
    expect(CLIMB_KEY).toBe(
      "places it climbs among the acts you pasted, not in Qloo's top 50, once a venue's fans join the headliners'; this check reads no venue abroad",
    );
  });
});
