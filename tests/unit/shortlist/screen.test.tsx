// @vitest-environment jsdom
// WS4, the buyer's shortlist, step 3: the page's sentence, the form, and the rows in the
// lineup's row style, sorted by climb, each with its venue, fee range and genre fit. Invented
// names and ids (tests/unit/shortlist/world.ts).
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShortlistResults } from "@/components/shortlist/shortlist-results";
import { ShortlistScreen } from "@/components/shortlist/shortlist-screen";
import { SHORTLIST_LEAD } from "@/components/shortlist/words";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { callBudget, checkShortlist } from "@/server/shortlist";
import { qlooWorld, savedBuild, shortlistQloo } from "./world";

afterEach(cleanup);

async function shortlist() {
  const world = qlooWorld(shortlistQloo());
  return checkShortlist({
    festival: SAGEBRUSH_SOUND,
    build: savedBuild(),
    names: [
      "Velvet Coyote",
      "Marigold Static",
      "Lowland Choir",
      "Nobody Knows Us",
      "Silver Mesa",
    ],
    budget: callBudget({ ...world, cap: 14 }),
  });
}

describe("the shortlist page (WS4, step 3)", () => {
  it("opens on the sentence, a town picker of the checked towns and the pasted names", () => {
    render(<ShortlistScreen />);

    expect(screen.getByText(SHORTLIST_LEAD)).toBeTruthy();
    const town = screen.getByRole("combobox", { name: "Town" });
    expect(within(town).getAllByRole("option")).toHaveLength(
      CHECKED_TOWNS.length,
    );
    expect((town as HTMLSelectElement).value).toBe(SAGEBRUSH_SOUND.id);
    expect(
      screen.getByRole("textbox", { name: /acts you've been pitched/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Sort them on Qloo" }),
    ).toBeTruthy();
  });

  it("prints the rows by climb, each with its venue, fee range and genre fit", async () => {
    render(
      <ShortlistResults
        shortlist={await shortlist()}
        title="Sorted for Boise"
      />,
    );

    const rows = within(
      screen.getByRole("list", { name: "Your acts, by climb" }),
    ).getAllByRole("article");
    // Three climb 1 place each: the better place with the venue's fans first.
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Marigold Static",
      "Silver Mesa",
      "Lowland Choir",
      "Velvet Coyote",
      "Nobody Knows Us",
    ]);
    const marigold = rows[0].textContent ?? "";
    expect(marigold).toContain("The Lantern Room's fans lift it");
    expect(marigold).toContain("Qloo popularity 86th · in the mid-size range");
    expect(marigold).toContain(
      "2 genres shared with the headliners: Dream Pop, Indie Pop",
    );
    expect(rows[4].textContent).toContain("Not found on Qloo");
  });

  it("says what each venue's fans did, and names the venue Qloo had no fan data for", async () => {
    render(
      <ShortlistResults
        shortlist={await shortlist()}
        title="Sorted for Boise"
      />,
    );

    const venues = within(
      screen.getByRole("list", { name: "Venue fans read" }),
    ).getAllByRole("listitem");
    expect(venues.map((venue) => venue.textContent)).toEqual([
      "The Lantern Room's fans lift 2 of your acts",
      "Fort Street Ballroom's fans lift 1 of your acts",
      "Qloo had no fan data for Cottonwood Social Hall",
    ]);
  });
});
