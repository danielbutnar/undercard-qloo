// @vitest-environment jsdom
// M10b: the evidence and the five objections move to /method/evidence, unchanged.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MethodEvidencePage } from "@/components/method-evidence";

afterEach(cleanup);

describe("the evidence page (M10b)", () => {
  it("holds both evidence tables, the five objections and the limits", () => {
    render(<MethodEvidencePage />);
    const tables = ["Does the idea hold?", "Does the product work?"].map(
      (name) => screen.getByRole("table", { name }),
    );
    const rows = tables.flatMap((table) =>
      within(table).getAllByRole("row").slice(1),
    );
    // M8f's second premise test makes 16, section 31's With and Without Qloo 17.
    expect(rows).toHaveLength(17);
    for (const question of [
      "Does the town know these acts?",
      "What does the AI model decide, and what does Qloo decide?",
      "Why venues?",
      "What happens when a town is thin?",
      "Why trust a pick?",
    ])
      expect(screen.getByRole("region", { name: question })).toBeTruthy();
    expect(
      screen.getByRole("region", {
        name: "What these numbers don't establish",
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Back to How it works" })
        .getAttribute("href"),
    ).toBe("/method");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
