// @vitest-environment jsdom
// Evidence section 34's copy changes (Daniel's yes, 2026-10-22): the premise test isn't shown to
// be the town's own, and the booked acts start lower; the evidence page says so and links it.
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MethodEvidencePage } from "@/components/method-evidence";
import { evidenceAnchor } from "@/lib/method";

afterEach(cleanup);

const heading = (n: number) =>
  readFileSync("docs/evidence.md", "utf8")
    .split("\n")
    .find((line) => line.startsWith(`## ${n}. `))!
    .slice(3);
const anchorOf = (link: HTMLElement) =>
  link.getAttribute("href")!.split("#")[1];
const text = (element: HTMLElement) =>
  element.textContent!.replace(/\s+/g, " ").trim();

describe("section 34 on the evidence page", () => {
  it("narrows the partly shown line to venue fans, with the control and the head start linked", () => {
    render(<MethodEvidencePage />);
    const item = screen
      .getAllByRole("listitem")
      .find((li) => text(li).startsWith("Partly shown:"))!;
    expect(text(item)).toBe(
      "Partly shown: venue fans like the acts festivals book. At 40 real festivals, the acts each festival booked showed more lift from the town's venues than band-matched random acts at 27: 7 of 10 in the first round, one short of its bar of 8, and 20 of 30 in the second, the bar set beforehand. With another country's venues in place of the town's, they still did at 18 of those 30, so the test doesn't show the edge is the town's own, and the random acts start higher in the headliners' ranking, which leaves the booked acts more room to climb (evidence 34). The differences are small. Treefort 2026 used two of the three Boise venues tested.",
    );
    const link = within(item).getByRole("link", { name: "evidence 34" });
    expect(anchorOf(link)).toBe(evidenceAnchor(heading(34)));
  });

  it("puts the control first in the second premise row's limit, with section 34 as a source", () => {
    render(<MethodEvidencePage />);
    const idea = screen.getByRole("table", { name: "Does the idea hold?" });
    const row = within(idea)
      .getAllByRole("row")
      .find((tr) =>
        text(tr).startsWith("At 30 real festivals chosen before any run"),
      )!;
    const limit = row.querySelector<HTMLElement>("td.evidence-limit")!;
    expect(text(limit)).toBe(
      "No margin, and not the town's own: with another country's venues the booked acts still led at 18 of 30, and at all 22 scored they start lower in the headliners' ranking than the random acts (evidence 34). The 8 festivals with fewer than two acts in the fee ranges couldn't be scored and count against the bar. The differences are small, 0.003 to 0.059 in affinity. Most lineups don't name their headliners first. Research subagents gathered the lineups; 28 of 30 were checked against their pages.",
    );
    expect(within(row).getAllByRole("link").map(anchorOf)).toEqual([
      evidenceAnchor(heading(26)),
      evidenceAnchor(heading(34)),
    ]);
  });
});
