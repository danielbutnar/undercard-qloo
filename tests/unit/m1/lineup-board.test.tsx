// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import { LineupBoard } from "@/components/lineup-board";
import { LineupSchema } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

afterEach(cleanup);

const { acts } = LineupSchema.parse(fixture);
const bands = SAGEBRUSH_SOUND.feeBands;

describe("LineupBoard with the synthetic lineup", () => {
  it("renders all 10 acts", () => {
    render(<LineupBoard bands={bands} acts={acts} />);
    expect(screen.getAllByRole("article")).toHaveLength(10);
  });

  it("puts 4 acts under Mid and 6 under Opener", () => {
    render(<LineupBoard bands={bands} acts={acts} />);
    const mid = screen.getByRole("region", { name: /^Mid/ });
    const opener = screen.getByRole("region", { name: /^Opener/ });
    expect(within(mid).getAllByRole("article")).toHaveLength(4);
    expect(within(opener).getAllByRole("article")).toHaveLength(6);
  });

  it("shows each act's Qloo affinity, popularity percentile, Why Boise line and two tags", () => {
    render(<LineupBoard bands={bands} acts={acts} />);
    const card = screen.getByRole("article", { name: "Hollow Pines" });
    expect(within(card).getByText("0.94")).toBeTruthy();
    expect(within(card).getByText("91st")).toBeTruthy();
    expect(within(card).getByText(/The Lantern Room/)).toBeTruthy();
    const tags = within(card).getByRole("list", { name: /tags shared/i });
    expect(
      within(tags)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Dream Pop", "Psychedelic Rock"]);
  });

  it("names each band with its popularity range and slot count", () => {
    render(<LineupBoard bands={bands} acts={acts} />);
    expect(
      screen.getByText(/4 slots · popularity 80th–92nd percentile/),
    ).toBeTruthy();
    expect(
      screen.getByText(/6 slots · popularity 55th–80th percentile/),
    ).toBeTruthy();
  });
});

describe("LineupBoard before a build", () => {
  it("shows every slot open", () => {
    render(<LineupBoard bands={bands} acts={[]} />);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getAllByText("Open slot")).toHaveLength(10);
  });
});
