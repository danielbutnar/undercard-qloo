// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { yourFestival } from "@/lib/your-festival";

afterEach(cleanup);

const follows = (first: Element, second: Element) =>
  Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

describe("the first screen for a lay reader (M6q)", () => {
  it("opens on what Undercard does, in plain words, then on what Qloo is", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    const lead = screen.getByRole("region", { name: "What Undercard does" });
    const lines = [...lead.querySelectorAll("p")].map((p) => p.textContent);
    expect(lines[0]).toBe("You booked the headliners.");
    expect(lines[1]).toBe(
      "Undercard drafts the rest from what fans of Boise's music venues like.",
    );
    // WS9: the top bar says it's an AI agent and what Qloo is, where Qloo is first named.
    expect(
      within(screen.getByRole("banner")).getByText(/^An AI agent/).textContent,
    ).toBe(
      "An AI agent for festival bookers, built on Qloo, a taste-data service that maps what fans of one artist, venue or film also like.",
    );
    // The lead comes first; the With Qloo / Without Qloo tabs sit on the poster, over its
    // festival name, never in the top bar or the lead (WS9's layout brief).
    const draft = screen.getByRole("region", { name: "Undercard draft" });
    expect(follows(lead, draft)).toBe(true);
    const mode = screen.getByRole("group", { name: "Which bill" });
    expect(
      within(screen.getByRole("banner")).queryByRole("group", {
        name: "Which bill",
      }),
    ).toBeNull();
    expect(
      within(lead).queryByRole("group", { name: "Which bill" }),
    ).toBeNull();
    expect(draft.contains(mode)).toBe(true);
    expect(
      follows(mode, screen.getByRole("heading", { level: 1, name: "Sagebrush Sound" })),
    ).toBe(true);
  });

  it("says under the headliners that the demo's two headliners are bands", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    const draft = screen.getByRole("region", { name: "Undercard draft" });
    const headliners = within(draft).getByRole("list", {
      name: "Booked headliners",
    });
    expect(
      within(headliners)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Khruangbin", "Japanese Breakfast"]);
    // The old example line's town and size are in the facts line above them.
    expect(
      within(draft).getByText(
        "Boise, Idaho · 3,000 capacity · crowd aged 25–34",
      ),
    ).toBeTruthy();
    // WS9: the label over them says they're booked, and that the demo's two are bands.
    const label = within(draft).getByText("Booked by you: two bands");
    expect(follows(label, headliners)).toBe(true);
  });

  it("doesn't call a judge's own headliners bands", () => {
    const brief = {
      city: "Duluth",
      region: "Minnesota",
      headliners: ["Mitski", "Khruangbin"] as [string, string],
    };
    render(
      <FestivalScreen
        festival={yourFestival(brief, "yours-test")}
        custom={{ brief, onEdit: () => {} }}
      />,
    );
    const draft = screen.getByRole("region", { name: "Undercard draft" });
    expect(
      within(within(draft).getByRole("list", { name: "Booked headliners" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Mitski", "Khruangbin"]);
    expect(within(draft).getByText("Booked by you")).toBeTruthy();
    expect(screen.queryByText(/two bands/)).toBeNull();
  });

  it("names each band in plain words first", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    expect(screen.getByRole("region", { name: "Mid-size acts" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Opening acts" })).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /Build undercard|Watch the AI agent build it/,
      }),
    ).toBeTruthy();
  });
});
