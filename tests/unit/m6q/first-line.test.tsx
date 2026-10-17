// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { yourFestival } from "@/lib/your-festival";

afterEach(cleanup);

describe("the first screen for a lay reader (M6q)", () => {
  it("opens on what Undercard does, in plain words, then the example", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    const banner = screen.getByRole("banner");
    const lines = [...banner.querySelectorAll("p")].map((p) => p.textContent);
    expect(lines[0]).toBe(
      "Undercard helps a music festival choose the smaller acts that play before the stars, using what the town's own music fans already like.",
    );
    expect(lines[1]).toBe(
      "Example: a 3,000-person festival in Boise, Idaho. Its headliners, Khruangbin and Japanese Breakfast, are bands.",
    );
    expect(within(banner).queryByRole("group", { name: "Which bill" })).toBeNull();
    expect(screen.getByRole("group", { name: "Which bill" })).toBeTruthy();
  });

  it("doesn't call a judge's own headliners bands", () => {
    const brief = { city: "Duluth", region: "Minnesota", headliners: ["Mitski", "Khruangbin"] as [string, string] };
    render(<FestivalScreen festival={yourFestival(brief, "yours-test")} custom={{ brief, onEdit: () => {} }} />);
    expect(within(screen.getByRole("banner")).getByText(/Its headliners, Mitski and Khruangbin, are already booked\./)).toBeTruthy();
  });

  it("names each band in plain words first", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);
    expect(screen.getByRole("region", { name: "Mid-size acts" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Opening acts" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Build undercard|Watch how it picked these acts/ }).length).toBeGreaterThan(0);
  });
});
