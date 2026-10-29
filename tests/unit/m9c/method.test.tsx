// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MethodEvidencePage } from "@/components/method-evidence";
import { MethodPage } from "@/components/method-page";
import { evidenceAnchor, EVIDENCE_URL } from "@/lib/method";

afterEach(cleanup);

// GitHub's heading anchors for the sections the page links to.
const headings = readFileSync("docs/evidence.md", "utf8")
  .split("\n")
  .filter((line) => line.startsWith("## "))
  .map((line) => evidenceAnchor(line.slice(3)));

describe("the method page (M9c)", () => {
  it("makes GitHub's anchors from evidence headings", () => {
    expect(
      evidenceAnchor(
        "1. Why a club's crowd: Boise's own festival books Boise's rooms",
      ),
    ).toBe("1-why-a-clubs-crowd-boises-own-festival-books-boises-rooms");
    expect(
      evidenceAnchor(
        "18. Premise test on real festivals (M8d), written before the measurement",
      ),
    ).toBe(
      "18-premise-test-on-real-festivals-m8d-written-before-the-measurement",
    );
  });

  // Since M10b the objections and the evidence are on /method/evidence, unchanged.
  it("answers the five objections, each claim linked to its row in docs/evidence.md", () => {
    render(<MethodEvidencePage />);
    for (const question of [
      "Does the town know these acts?",
      "What does the AI model decide, and what does Qloo decide?",
      "Why venues?",
      "What happens when a town is thin?",
      "Why trust a pick?",
    ]) {
      const section = screen.getByRole("region", { name: question });
      const links = within(section).getAllByRole("link");
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        const href = link.getAttribute("href")!;
        expect(href.startsWith(`${EVIDENCE_URL}#`)).toBe(true);
        expect(headings).toContain(href.split("#")[1]);
      }
    }
  });

  it("holds one picture of the method, and the evidence its own page links to", () => {
    render(<MethodPage />);
    expect(
      screen.getAllByRole("img", { name: /How Undercard drafts a lineup/ }),
    ).toHaveLength(1);
    expect(
      screen
        .getByRole("link", { name: "Back to the lineup" })
        .getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: /^The evidence/ }).getAttribute("href"),
    ).toBe("/method/evidence");
  });

  it("holds the evidence table with its stated limits on the evidence page", () => {
    render(<MethodEvidencePage />);
    const tables = ["Does the idea hold?", "Does the product work?"].map(
      (name) => screen.getByRole("table", { name }),
    );
    const rows = tables.flatMap((table) => within(table).getAllByRole("row"));
    expect(rows.length).toBeGreaterThan(10);
    for (const table of tables)
      for (const link of within(table).getAllByRole("link"))
        expect(headings).toContain(link.getAttribute("href")!.split("#")[1]);
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
  });

  // Daniel, 2026-10-28: section 37's two limits, with no names, on the evidence page too.
  it("lists section 37's two limits on the controls, linked to section 37", () => {
    render(<MethodEvidencePage />);
    const limits = screen.getByRole("region", {
      name: "What these numbers don't establish",
    });
    const text = (limits.textContent ?? "").replace(/\s+/g, " ");
    expect(text).toContain(
      "The control room is matched on Qloo popularity alone, not on size or style: one small club's control was an arena, another venue's a pool bar. A control that draws a different crowd makes the bar easier to clear.",
    );
    expect(text).toContain(
      "Every control is abroad, so a local lift can reflect the country as much as the town: one opening act clears the bar in all four US demo towns.",
    );
    const links = within(limits).getAllByRole("link", { name: "Section 37" });
    expect(links).toHaveLength(2);
    for (const link of links)
      expect(headings).toContain(link.getAttribute("href")!.split("#")[1]);
  });

  // Daniel, 2026-10-29: section 38's result, NOT SHOWN, as a limit.
  it("lists section 38's limit, linked to section 38", () => {
    render(<MethodEvidencePage />);
    const limits = screen.getByRole("region", {
      name: "What these numbers don't establish",
    });
    expect((limits.textContent ?? "").replace(/\s+/g, " ")).toContain(
      "That Undercard finds the acts festivals actually book: at 33 real festivals its shortlists didn't beat the model alone, or the same agent with another country's venues (section 38).",
    );
    const link = within(limits).getByRole("link", { name: "section 38" });
    expect(headings).toContain(link.getAttribute("href")!.split("#")[1]);
  });

  it("loads the video only when it's played", () => {
    render(<MethodPage videoUrl="https://example.org/demo.mp4" />);
    expect(document.querySelector("video, iframe")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Play the demo video" }),
    );
    expect(document.querySelector("video")?.getAttribute("src")).toBe(
      "https://example.org/demo.mp4",
    );
  });

  it("says when the video isn't published yet", () => {
    render(<MethodPage videoUrl={null} />);
    expect(document.querySelector("video, iframe")).toBeNull();
    expect(screen.getByText(/The demo video will play here/)).toBeTruthy();
  });
});
