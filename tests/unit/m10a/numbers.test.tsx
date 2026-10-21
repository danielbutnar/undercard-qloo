// @vitest-environment jsdom
// M10a, the numbers beside each act (docs/evidence.md section 27): the two variants the lay
// readers judge, on the synthetic lineup with invented places that agree with its moves.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BandChart, type RowNumbers } from "@/components/chart/band-chart";
import { billRows } from "@/components/chart/chart-rows";
import type { FeeBandId } from "@/lib/fee-bands";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { venueHues } from "@/lib/venue-colours";
import { acts } from "../m4b/first-bill-fixture";

afterEach(cleanup);

const id = (n: number) => `00000000-0000-4000-8000-000000000${n}`;
const PLACES = {
  [id(101)]: { now: 3, was: 14 }, // Hollow Pines, up 11
  [id(102)]: { now: 6, was: 13 }, // Marisol Vey, up 7
  [id(103)]: { now: 2, was: 28 }, // The Ditch Riders, up 26
  [id(104)]: { now: 9, was: 18 }, // Kestrel & Bloom, up 9
  [id(105)]: { now: 1, was: 31 }, // Juniper Static, up 30
  [id(106)]: { now: 4, was: 19 }, // Owyhee Drift, up 15
  [id(107)]: { now: 5, was: 28 }, // Saltgrass, up 23
  [id(108)]: { now: 7, was: 21 }, // Teddy Arcana, up 14
  [id(109)]: { now: 8, was: null }, // Low Bench Choir, new to the top 50
  [id(110)]: { now: 10, was: 22 }, // Cass Wren, up 12
};

function chart(band: FeeBandId, numbers: RowNumbers) {
  const fee = SAGEBRUSH_SOUND.feeBands.find((entry) => entry.id === band)!;
  render(
    <BandChart
      band={fee}
      rows={billRows(
        fee,
        acts,
        PLACES,
        venueHues([], acts),
        0,
        undefined,
        numbers,
      )}
      sortKey="bill"
      motion={false}
      numbers={numbers}
    />,
  );
  return screen.getAllByRole("article");
}

const names = (rows: HTMLElement[]) =>
  rows.map((row) => row.getAttribute("aria-label"));
// The row's big number as it's seen, and whether a drawn climb mark leads it.
const big = (row: HTMLElement) =>
  row.querySelector(".row-place")!.textContent!.trim();
const marked = (row: HTMLElement) =>
  row.querySelector(".row-place svg.tri") !== null;

describe("variant (a): the climb as the hero", () => {
  it("prints each act's climb as its big number, the biggest climb first", () => {
    const rows = chart("mid", "climb");
    expect(names(rows)).toEqual([
      "The Ditch Riders",
      "Hollow Pines",
      "Kestrel & Bloom",
      "Marisol Vey",
    ]);
    expect(rows.map(big)).toEqual(["26", "11", "9", "7"]);
    expect(rows.every(marked)).toBe(true);
  });

  it("sets a small ladder from the place for the headliners' fans alone to the place now", () => {
    const [riders] = chart("mid", "climb");
    expect(riders.querySelector(".ladder")!.textContent).toBe("28th2nd");
    expect(riders.querySelector(".ladder svg")).not.toBeNull();
    // The venue tab as now, and the words a screen reader hears.
    expect(riders.querySelector(".row-venue")!.textContent).toBe(
      "The Lantern Room",
    );
    expect(riders.querySelector(".sr-only")!.textContent).toBe(
      "The Lantern Room's crowd: up 26 places",
    );
  });

  it("calls an act from outside the top 50 NEW, placed by the least it can have climbed", () => {
    const rows = chart("opener", "climb");
    // From outside the top 50 into 8th is at least 43 places, more than any other climb here.
    expect(names(rows)[0]).toBe("Low Bench Choir");
    expect(big(rows[0])).toBe("NEW");
    expect(marked(rows[0])).toBe(false);
    expect(rows[0].querySelector(".ladder")!.textContent).toBe(
      "outside the top 508th",
    );
    expect(rows.slice(1).map(big)).toEqual(["30", "23", "15", "14", "12"]);
  });
});

describe("variant (a)'s one-line key (added after round 1, evidence section 27)", () => {
  it("says under each band what the climb is, with the same drawn mark", () => {
    chart("mid", "climb");
    const key = document.querySelector(".numbers-key")!;
    expect(key.textContent).toBe(
      "places it climbed with its venue's fans added",
    );
    expect(key.querySelector("svg.tri")).not.toBeNull();
  });

  it("isn't on the place or slot charts, nor on a band with no act yet", () => {
    chart("mid", "slot");
    expect(document.querySelector(".numbers-key")).toBeNull();
    cleanup();
    chart("mid", "place");
    expect(document.querySelector(".numbers-key")).toBeNull();
    cleanup();
    const fee = SAGEBRUSH_SOUND.feeBands[0];
    render(
      <BandChart
        band={fee}
        rows={billRows(fee, [], {}, new Map(), 4, undefined, "climb")}
        sortKey="bill"
        motion={false}
        numbers="climb"
      />,
    );
    expect(document.querySelector(".numbers-key")).toBeNull();
  });
});

describe("variant (b): the lineup slot as the row number", () => {
  it("numbers the rows 1 to 4 in the lineup's own order", () => {
    const rows = chart("mid", "slot");
    expect(names(rows)).toEqual([
      "Hollow Pines",
      "Marisol Vey",
      "The Ditch Riders",
      "Kestrel & Bloom",
    ]);
    expect(rows.map(big)).toEqual(["1", "2", "3", "4"]);
    expect(rows.some(marked)).toBe(false);
  });

  it("gives the climb as the evidence line under the name", () => {
    const [pines, vey] = chart("mid", "slot");
    expect(pines.querySelector(".row-evidence")!.textContent).toBe(
      "11 · 14th → 3rd with The Lantern Room's fans",
    );
    expect(pines.querySelector(".row-evidence svg.tri")).not.toBeNull();
    expect(vey.querySelector(".row-evidence")!.textContent).toBe(
      "7 · 13th → 6th with FSB's fans",
    );
  });

  it("numbers the opening acts 1 to 6, a new entry's line saying where it came from", () => {
    const rows = chart("opener", "slot");
    expect(rows.map(big)).toEqual(["1", "2", "3", "4", "5", "6"]);
    const choir = rows[names(rows).indexOf("Low Bench Choir")];
    expect(choir.querySelector(".row-evidence")!.textContent).toBe(
      "NEW · outside the top 50 → 8th with The Lantern Room's fans",
    );
  });
});

describe("the place, as the chart prints it today", () => {
  it("stays the default", () => {
    const fee = SAGEBRUSH_SOUND.feeBands[0];
    render(
      <BandChart
        band={fee}
        rows={billRows(fee, acts, PLACES, venueHues([], acts))}
        sortKey="bill"
        motion={false}
      />,
    );
    expect(screen.getAllByRole("article").map(big)).toEqual([
      "2",
      "3",
      "6",
      "9",
    ]);
  });
});
