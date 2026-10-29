// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { markKey } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(cleanup);

// Two cold readers of the live screen said "local Boise crowds" and never "venues": the
// screen named crowds and rooms, and the venue only by its name.
describe("the venues behind the bill", () => {
  it("names them as Boise venues in the rail's heading, as crowds rather than stages", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    // The lead says it; since WS18 item 2 the town's legend names each venue and its acts.
    expect(
      screen.getByRole("region", { name: "What Undercard does" }).textContent,
    ).toContain("fans of Boise's music venues");
    expect(
      screen.getByRole("region", { name: "Your town" }).textContent,
    ).toContain("The Lantern Room's fans lifted 7 acts onto this lineup");
  });

  it("calls the first mark's room a Boise venue in the key", () => {
    expect(
      markKey(acts[0], { acts: [acts[0]], top: 50, city: "Boise" }).lines[0],
    ).toBe(
      "Qloo ranks artists for the headliners' fans; adding the crowd at The Lantern Room, a Boise venue, lifts this act 11 places.",
    );
  });
});
