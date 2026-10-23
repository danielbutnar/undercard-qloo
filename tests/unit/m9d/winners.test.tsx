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
import { liftOf } from "@/lib/marks";
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

// WS9: the first screen's chart is a poster now; each act keeps what M9d's winner gave it, its
// venue (by colour, matching the town and the key) and its climb, and its card the full words.
describe("the first screen's poster (after M9d's winner)", () => {
  it("sets each act on the poster: its name in its venue's colour, its climb beside it, and its venue's fans in words", () => {
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
    // The venue whose fans lift it: its colour, the same as its venue's switch on the poster's
    // key, and its fans in words...
    const hue = /\bvenue-(\d)\b/.exec(row.className)![1];
    const key = within(
      screen.getByRole("group", { name: "Venue fans used for this draft" }),
    ).getByLabelText(new RegExp(`^${first.anchorVenue.name}'s fans: `));
    expect(key.querySelector(".poster-ink-swatch")!.className).toContain(
      `venue-${hue}`,
    );
    expect(
      within(row).getByText(
        `With ${first.anchorVenue.name}'s fans added: up ${move} places in Qloo's ranking`,
      ),
    ).toBeTruthy();
    // ...and its climb beside its name (M10a), in the body face (Anton draws ↑ too small).
    expect(row.querySelector(".poster-climb")!.textContent).toBe(`↑${move}`);
    // The card says in full whose fans lift it.
    fireEvent.click(within(row).getByRole("button", { name: first.name }));
    expect(
      within(screen.getByRole("region", { name: "Act card" })).getByText(
        `Climbs with ${first.anchorVenue.name}'s fans added`,
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
