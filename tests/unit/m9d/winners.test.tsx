// @vitest-environment jsdom
// M9d: the blind tournament's winners, shipped (docs/evidence.md section 24), as the weekly chart
// carries them. The first screen's bands are charts with a climb arrow per act as long as its
// move; the climb says where a lifted act came from; the method page sets its diagram full width
// over two columns.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BandChart } from "@/components/chart/band-chart";
import { editionRows } from "@/components/chart/chart-rows";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodEvidencePage } from "@/components/method-evidence";
import { wasPlace, type ClimbEvent } from "@/lib/lift-climb";
import { liftOf, roomShortName } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(cleanup);

// A row's words as they're seen: without the ones kept for screen readers.
const seen = (node: Node) => {
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".sr-only").forEach((child) => child.remove());
  return clone.textContent ?? "";
};

// One edition of Watch's chart: a band's list after a venue's fans were added.
function renderEdition(step: ClimbEvent) {
  render(
    <BandChart
      band={SAGEBRUSH_SOUND.feeBands[0]}
      rows={editionRows(step, [], {}, new Map())}
      sortKey={step}
      motion={false}
    />,
  );
  return screen.getAllByRole("listitem");
}

const edition = (
  moves: (number | null)[],
  venue: ClimbEvent["venue"] = { entityId: "v1", name: "The Lantern Room" },
): ClimbEvent => ({
  type: "climb",
  band: "mid",
  venue,
  acts: moves.map((move, index) => ({
    entityId: `a${index}`,
    name: `Act ${index + 1}`,
    move,
  })),
});

describe("the first screen's chart (M9d winner)", () => {
  it("sets each act as a row: its name, the venue whose fans like it, its climb and a ladder as long as the climb", () => {
    const first = acts.find((act) => act.band === "mid")!;
    const lift = liftOf(first);
    expect(lift?.kind).toBe("up");
    const move = (lift as { places: number }).places;
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{
          ...FIRST_BILL,
          places: { [first.entityId]: { now: 1, was: 1 + move } },
        }}
      />,
    );
    const mid = screen.getByRole("region", { name: "Mid-size acts" });
    expect(within(mid).getAllByRole("article")).toHaveLength(4);
    const row = within(mid).getByRole("article", { name: first.name });
    expect(within(row).getByRole("button", { name: first.name })).toBeTruthy();
    // The venue whose fans like it: its mark and its crowd on the row...
    expect(
      within(row).getByText(roomShortName(first.anchorVenue.name)),
    ).toBeTruthy();
    expect(
      within(row).getByText(
        `${first.anchorVenue.name}'s crowd: up ${move} places`,
      ),
    ).toBeTruthy();
    // ...the climb as the big number (M10a), and under the name the ladder from the place it
    // came from up to the place now...
    expect(row.querySelector(".row-place")!.textContent).toBe(String(move));
    expect(row.querySelector(".ladder")!.textContent).toMatch(
      new RegExp(`^${move + 1}(st|nd|rd|th)1st$`),
    );
    // ...with an arrow as long as the climb: 50 places fill it, a short climb keeps a stub.
    expect(row.querySelector(".ladder")!.getAttribute("aria-hidden")).toBe(
      "true",
    );
    for (const article of within(mid).getAllByRole("article")) {
      // A row whose places the build doesn't give reads "up N places", with no arrow.
      const arrow = article.querySelector<HTMLElement>(".ladder-arrow");
      if (!arrow) continue;
      const climb = Number(article.querySelector(".row-place")!.textContent);
      expect(arrow.style.getPropertyValue("--share")).toBe(
        String(Math.min(1, Math.max(0.18, climb / 50))),
      );
    }
    expect(row.querySelector(".ladder-arrow")).not.toBeNull();
    // The card says in full whose fans like it.
    fireEvent.click(within(row).getByRole("button", { name: first.name }));
    expect(
      within(screen.getByRole("region", { name: "Act card" })).getByText(
        `${first.anchorVenue.name} fans like it`,
      ),
    ).toBeTruthy();
    // M9d's separate key note stays gone; since M10a each band has a one-line key instead.
    expect(
      screen.queryByRole("note", { name: "How to read the marks" }),
    ).toBeNull();
  });
});

describe("the climb says where a lifted act came from (M9d winner)", () => {
  it("names the place an act held before the venue's fans were added", () => {
    expect(wasPlace(1, 49)).toBe("was 50th");
    expect(wasPlace(2, 19)).toBe("was 21st");
    expect(wasPlace(3, 9)).toBe("was 12th");
    expect(wasPlace(1, 2)).toBe("was 3rd");
    expect(wasPlace(1, 1)).toBe("was 2nd");
    expect(wasPlace(1, 110)).toBe("was 111th");
  });

  it("prints that place on each lifted row: its rank in the list plus its move", () => {
    // Each act's place in the list now is its rank; the place it held is its rank plus its move.
    const was = (moves: number[]) => {
      const names = renderEdition(edition(moves)).map(
        (row) => /was (\d+(?:st|nd|rd|th))/.exec(seen(row))![1],
      );
      cleanup();
      return names;
    };
    expect(was([49, 19, 9, 107])).toEqual(["50th", "21st", "12th", "111th"]);
    expect(was([1, 1])).toEqual(["2nd", "3rd"]);
  });

  it("labels each lifted act with its move, the venue and its old place", () => {
    const rows = renderEdition({
      type: "climb",
      band: "mid",
      venue: { entityId: "v1", name: "The Lantern Room" },
      acts: [
        { entityId: "a1", name: "Hollow Pines", move: 11 },
        { entityId: "a2", name: "Marisol Vey", move: null },
      ],
    });
    expect(rows).toHaveLength(2);
    const lifted = seen(rows[0]);
    expect(lifted).toContain("Hollow Pines");
    expect(lifted).toMatch(/\+11\s*was 12th/);
    expect(lifted).toContain("The Lantern Room");
    // An act the venue's fans didn't lift carries none of it.
    expect(seen(rows[1])).toContain("Marisol Vey");
    expect(seen(rows[1])).not.toMatch(/\+\d|was \d|The Lantern Room/);
  });
});

describe("the evidence's layout (M9d winner; on /method/evidence since M10b)", () => {
  it("sets the evidence and the objections side by side", () => {
    render(<MethodEvidencePage />);
    const evidence = screen.getByRole("region", { name: "Evidence" });
    const objections = screen.getByRole("region", { name: "Five objections" });
    const columns = evidence.closest(".method-columns");
    expect(columns).not.toBeNull();
    expect(columns!.contains(objections)).toBe(true);
  });
});

