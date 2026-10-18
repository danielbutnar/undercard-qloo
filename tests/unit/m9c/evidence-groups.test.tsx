// @vitest-environment jsdom
// The method page's evidence (after M9d): three plain lines on what is shown, partly shown and
// not shown, then the table in two groups, the premise tests and the engineering checks, with
// every row and its limit kept.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MethodPage } from "@/components/method-page";

afterEach(cleanup);

describe("the method page's evidence, grouped", () => {
  it("opens with what is shown, partly shown and not shown, above the tables", () => {
    render(<MethodPage />);
    const evidence = screen.getByRole("region", { name: "Evidence" });
    const lines = within(evidence).getAllByRole("listitem").slice(0, 3);
    expect(lines.map((line) => line.textContent?.split(":")[0])).toEqual([
      "Shown",
      "Partly shown",
      "Not shown",
    ]);
    const firstTable = within(evidence).getAllByRole("table")[0];
    expect(
      lines[2].compareDocumentPosition(firstTable) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("splits the table into the premise tests and the engineering checks, every row with its limit", () => {
    render(<MethodPage />);
    const idea = screen.getByRole("table", { name: "Does the idea hold?" });
    const product = screen.getByRole("table", {
      name: "Does the product work?",
    });
    const rows = (table: HTMLElement) =>
      within(table).getAllByRole("row").slice(1);
    expect(rows(idea).length + rows(product).length).toBe(15);
    expect(
      within(idea).getByText("7 of 10, one short of the bar of 8"),
    ).toBeTruthy();
    expect(within(idea).getByText("No-go: 0 to 2 of 50 per list")).toBeTruthy();
    expect(within(product).getByText("29 of 29")).toBeTruthy();
    for (const row of [...rows(idea), ...rows(product)]) {
      const cells = within(row).getAllByRole("cell");
      expect(cells[2].textContent?.trim()).not.toBe("");
    }
  });
});
