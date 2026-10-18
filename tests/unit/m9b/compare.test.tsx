// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import { CompareTowns } from "@/components/compare-towns";
import { compareBills, DEFAULT_COMPARE } from "@/lib/compare";
import { LineupSchema } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { festivalById } from "@/lib/towns";

afterEach(cleanup);

const { acts } = LineupSchema.parse(fixture);
const austin = festivalById("sagebrush-sound-austin")!;
// Austin keeps three of Boise's acts and books seven of its own.
const austinActs = acts.map((act, index) =>
  index < 3
    ? act
    : {
        ...act,
        entityId: `austin-${index}`,
        name: `Austin Act ${index}`,
        anchorVenue: { entityId: "mohawk", name: "Venue 213 Austin" },
      },
);

describe("comparing two towns' lineups (M9b)", () => {
  it("marks the acts both lineups book and those only one does", () => {
    const diff = compareBills(acts, austinActs);
    expect(diff.shared.size).toBe(3);
    expect(diff.onlyA).toHaveLength(7);
    expect(diff.onlyB).toHaveLength(7);
  });

  it("defaults to Boise against Austin, the first town where both marks show", () => {
    expect(DEFAULT_COMPARE).toEqual({
      a: "sagebrush-sound",
      b: "sagebrush-sound-austin",
    });
  });

  it("sets the two lineups side by side, each act marked shared or only here, and says why they differ", () => {
    render(
      <CompareTowns
        left={{
          festival: SAGEBRUSH_SOUND,
          acts,
          venues: ["The Lantern Room", "Fort Street Ballroom"],
        }}
        right={{
          festival: austin,
          acts: austinActs,
          venues: ["Venue 213 Austin"],
        }}
        towns={[{ id: "sagebrush-sound-austin", label: "Austin, Texas" }]}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(
      /Boise against Austin/,
    );
    expect(
      screen.getByText(
        /same headliners \(Khruangbin and Japanese Breakfast\) and fee ranges/i,
      ),
    ).toBeTruthy();
    const left = screen.getByRole("region", { name: "Boise, Idaho" });
    const right = screen.getByRole("region", { name: "Austin, Texas" });
    expect(within(left).getAllByText("On both lineups")).toHaveLength(3);
    expect(within(left).getAllByText("Only in Boise")).toHaveLength(7);
    expect(within(right).getAllByText("Only in Austin")).toHaveLength(7);
    expect(within(right).getByText(/Venue 213 Austin/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Back to the lineup/ })
        .getAttribute("href"),
    ).toBe("/");
  });
});
