// @vitest-environment jsdom
// WS8 (item 12c): the switch panel below the poster says "no fan data" for a venue Qloo left
// unscored, as its sign does, and "lifted none" only for one whose fans moved nothing.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VenueSwitch } from "@/components/chart/venue-switch";

describe("the switch panel's venues (WS8)", () => {
  it("says no fan data for a venue Qloo had no fan data for", () => {
    render(
      <VenueSwitch
        city="Boise"
        venues={[
          { entityId: "a", name: "A Hall", hue: 0, lifted: 7 },
          { entityId: "b", name: "B Room", hue: 1, lifted: 0 },
          { entityId: "c", name: "C Club", hue: 2, lifted: 0, noFanData: true },
        ]}
        off={new Set()}
        status="ready"
        onToggle={() => {}}
        onReset={() => {}}
        filled={7}
        slots={10}
        placesListed={8}
      />,
    );
    expect(
      screen.getByRole("button", { name: "B Room: on, lifted none" }),
    ).toBeTruthy();
    const unscored = screen.getByRole("button", {
      name: "C Club: on, no fan data",
    });
    expect(unscored.textContent).toContain("no fan data");
  });
});
