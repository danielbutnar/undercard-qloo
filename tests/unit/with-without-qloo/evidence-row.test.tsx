// @vitest-environment jsdom
// Evidence section 31 on the evidence page: With and Without Qloo as a number, in plain words,
// linked to its section, drawn as a share of the model's 290 picks.
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MethodEvidencePage } from "@/components/method-evidence";
import { evidenceAnchor } from "@/lib/method";

afterEach(cleanup);

const SECTION_31 = readFileSync("docs/evidence.md", "utf8")
  .split("\n")
  .find((line) => line.startsWith("## 31. "))!
  .slice(3);

describe("With and Without Qloo on the evidence page (section 31)", () => {
  it("says how many of the model's own picks pass the three tests, linked to section 31", () => {
    render(<MethodEvidencePage />);
    const idea = screen.getByRole("table", { name: "Does the idea hold?" });
    const row = within(idea)
      .getAllByRole("row")
      .find((candidate) => /Without Qloo/.test(candidate.textContent ?? ""))!;
    expect(row).toBeTruthy();
    expect(
      within(row).getByText(
        "10 of 290 model picks pass all three; every Qloo act does",
      ),
    ).toBeTruthy();
    expect(
      within(row).getByRole("link").getAttribute("href")!.split("#")[1],
    ).toBe(evidenceAnchor(SECTION_31));
    expect(row.querySelector(".result-bar")).not.toBeNull();
  });

  // Corrected 2026-10-22: Duluth's two lineups share one act (section 31's own per-town counts).
  it("says the two lineups share no act in 28 of the 29 towns, and one in the other", () => {
    render(<MethodEvidencePage />);
    const idea = screen.getByRole("table", { name: "Does the idea hold?" });
    const row = within(idea)
      .getAllByRole("row")
      .find((candidate) => /Without Qloo/.test(candidate.textContent ?? ""))!;
    const limit = row.querySelector<HTMLElement>("td.evidence-limit")!;
    expect(limit.textContent).toBe(
      "Qloo's own measures, which the model can't see. The two lineups share no act in 28 of the 29 towns, and one in the other.",
    );
  });
});
