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

  it("answers the five objections, each claim linked to its row in docs/evidence.md", () => {
    render(<MethodPage />);
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

  it("holds one diagram, the evidence table with its stated limits, and no hero", () => {
    render(<MethodPage />);
    expect(
      screen.getAllByRole("img", { name: /How Undercard drafts a lineup/ }),
    ).toHaveLength(1);
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
        .getByRole("link", { name: "Back to the lineup" })
        .getAttribute("href"),
    ).toBe("/");
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
