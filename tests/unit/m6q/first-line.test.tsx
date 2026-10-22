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
    expect(lines[0]).toBe(
      "A festival lineup, drafted from Boise's own music venues.",
    );
    expect(lines[1]).toBe(
      "Undercard is an AI agent: it drafts a shortlist with its evidence attached; the buyer makes every call.",
    );
    expect(lines.at(-1)).toBe(
      "Qloo is a taste-data service: it maps what fans of one artist, venue or film also like.",
    );
    // The lead comes first; the With Qloo / Without Qloo switch sits below the bill, not up here.
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
    expect(
      follows(screen.getByRole("region", { name: "Opening acts" }), mode),
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
    // No lineup yet on this screen, so Undercard will draft the rest.
    const note = within(draft).getByText(
      "The headliners, two bands, are already booked · Undercard will draft the rest of the lineup (the bill) from Qloo's numbers",
    );
    expect(follows(headliners, note)).toBe(true);
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
    expect(
      within(draft).getByText(
        "The headliners are already booked · Undercard will draft the rest of the lineup (the bill) from Qloo's numbers",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/two bands/)).toBeNull();
  });

  it("names each band in plain words first", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    expect(screen.getByRole("region", { name: "Mid-size acts" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Opening acts" })).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: /Build undercard|Watch how it picked these acts/,
      }),
    ).toBeTruthy();
  });
});
