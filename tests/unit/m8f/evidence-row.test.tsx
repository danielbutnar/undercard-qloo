// @vitest-environment jsdom
// M8f: the second premise test's result sits on the evidence page next to the 7 of 10, which
// stays, drawn as 30 squares with the bar of 20 marked on the 20th, and linked to evidence section 26.
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MethodEvidencePage } from "@/components/method-evidence";
import { evidenceAnchor } from "@/lib/method";

afterEach(cleanup);

const SECTION_26 = readFileSync("docs/evidence.md", "utf8")
  .split("\n")
  .find((line) => line.startsWith("## 26. "))!
  .slice(3);

describe("the second premise test on the evidence page (M8f)", () => {
  it("adds its row to the premise tests, next to the 7 of 10, which stays", () => {
    render(<MethodEvidencePage />);
    const idea = screen.getByRole("table", { name: "Does the idea hold?" });
    const rows = within(idea).getAllByRole("row").slice(1);
    const first = rows.findIndex((row) =>
      row.textContent?.includes("7 of 10, one short of the bar of 8"),
    );
    expect(first).toBeGreaterThanOrEqual(0);
    // Plan.md item 10: the 30-festival round leads, with the 7 of 10 straight after it.
    const second = rows[first - 1];
    expect(second.textContent).toMatch(
      /^At 30 real festivals chosen before any run/,
    );
    // Its first source is section 26; section 34's controls follow it (tests/unit/evidence-34).
    expect(
      within(second)
        .getAllByRole("link")[0]
        .getAttribute("href")!
        .split("#")[1],
    ).toBe(evidenceAnchor(SECTION_26));
  });

  it("draws its result as 30 squares, as many filled as festivals supporting it, with the bar at 20", () => {
    render(<MethodEvidencePage />);
    const cell = [
      ...document.querySelectorAll<HTMLElement>("td.evidence-result"),
    ].find((td) => / of 30\b/.test(td.lastElementChild?.textContent ?? ""))!;
    const result = cell.lastElementChild!.textContent!;
    // Daniel's wording (third brief, 2026-10-21).
    expect(result).toBe(
      "20 of 30, the bar set beforehand; 20 of the 22 that could be scored",
    );
    const squares = [...cell.querySelectorAll(".result-dots i")];
    expect(squares).toHaveLength(30);
    expect(
      squares.filter((square) => square.classList.contains("on")),
    ).toHaveLength(Number(/^(\d+) of 30/.exec(result)![1]));
    // The bar is the 20th square, as the 7 of 10's bar of 8 is its 8th.
    expect(
      squares.findIndex((square) => square.classList.contains("bar")),
    ).toBe(19);
  });
});
