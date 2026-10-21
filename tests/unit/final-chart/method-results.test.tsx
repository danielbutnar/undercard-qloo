// @vitest-environment jsdom
// The method page draws a result only where its own words count something (one square per
// case, filled for each that passed, the bar marked; a count over 30 as a bar) or say go or
// no-go; a description gets no picture.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MethodEvidencePage } from "@/components/method-evidence";

afterEach(cleanup);

/** The result cell of the evidence row whose result reads `text`. */
function resultCell(text: string): HTMLElement {
  const cell = [
    ...document.querySelectorAll<HTMLElement>("td.evidence-result"),
  ].find((td) => td.lastElementChild?.textContent === text);
  if (!cell) throw new Error(`No evidence row reads "${text}"`);
  return cell;
}
const dots = (cell: HTMLElement) => [
  ...cell.querySelectorAll(".result-dots i"),
];
const on = (squares: Element[]) =>
  squares.filter((square) => square.classList.contains("on")).length;

describe("the method page's results, drawn", () => {
  it("draws a count as one square per case, filled for each that passed, with the bar marked", () => {
    render(<MethodEvidencePage />);
    const short = dots(resultCell("7 of 10, one short of the bar of 8"));
    expect(short).toHaveLength(10);
    expect(on(short)).toBe(7);
    expect(short.findIndex((square) => square.classList.contains("bar"))).toBe(
      7,
    );
    const all = dots(resultCell("29 of 29"));
    expect(all).toHaveLength(29);
    expect(on(all)).toBe(29);
    // Number words count as well as digits.
    const words = dots(
      resultCell(
        "Every run filled both groups; three of four towns gave the same ten acts",
      ),
    );
    expect(words).toHaveLength(4);
    expect(on(words)).toBe(3);
  });

  it("draws a count over 30 as a bar", () => {
    render(<MethodEvidencePage />);
    expect(
      resultCell("180 of 180 pairs within 10 calls").querySelector(
        ".result-bar",
      ),
    ).not.toBeNull();
  });

  it("marks go or no-go only where the result says so and counts nothing", () => {
    render(<MethodEvidencePage />);
    for (const go of [
      "Go, with at most one extra Qloo call",
      "Go: labelled, booking unchanged",
    ])
      expect(resultCell(go).querySelector(".result-chip.is-go")).not.toBeNull();
    expect(
      resultCell("No-go; they are labelled instead").querySelector(
        ".result-chip.is-nogo",
      ),
    ).not.toBeNull();
    // A no-go that counts something is drawn as its count.
    const none = dots(resultCell("No-go: 0 of 4 towns"));
    expect(none).toHaveLength(4);
    expect(on(none)).toBe(0);
    expect(
      resultCell(
        "Retries with backoff inside a 45-second budget",
      ).querySelector(".result-dots, .result-bar, .result-chip"),
    ).toBeNull();
  });
});
