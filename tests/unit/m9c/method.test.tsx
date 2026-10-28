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

  // Since WS12 item 2 the picture is the director's cut, which needs a saved build; without one
  // the page still says who does what and links its evidence.
  it("says who does what, and links the evidence its own page holds", () => {
    render(<MethodPage />);
    expect(
      screen.getAllByRole("region", { name: "Who does what" }),
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

  // WS2: until the video is published the slot is gone, heading included, rather than dated.
  it("shows no video slot while the video isn't published", () => {
    render(<MethodPage videoUrl={null} />);
    expect(document.querySelector("video, iframe")).toBeNull();
    expect(screen.queryByRole("region", { name: "The demo video" })).toBeNull();
    expect(screen.queryByText(/The demo video will play here/)).toBeNull();
  });
});
