// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DraftBill } from "@/components/draft-bill";
import { markKey, markText } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { acts } from "../m4b/first-bill-fixture";

afterEach(cleanup);

const bill = () =>
  render(
    <DraftBill
      festival={SAGEBRUSH_SOUND}
      acts={acts}
      calls={12}
      createdAt="2026-10-15T14:02:00.000Z"
      top={{ mid: 50, opener: 50 }}
    />,
  );

describe("the fee band", () => {
  it("says the buyer sets the band and Qloo supplies the popularity percentile", () => {
    bill();
    expect(
      screen.getByText(
        "4 slots · fee range (Mid): with no real fees to go on, how popular an act is on Qloo stands in for what it charges (80th–92nd percentile)",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "6 slots · fee range (Opener): with no real fees to go on, how popular an act is on Qloo stands in for what it charges (55th–80th percentile)",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/set by Qloo/)).toBeNull();
  });
});

describe("the mark", () => {
  // Big Shoulders carries + at full weight; it has no ▲ (which fell back to another face)
  // and sets ↑ too small to read.
  it("counts places gained with +, a glyph the display font carries", () => {
    expect(
      markText({
        ...acts[1],
        reason: "Fort Street Ballroom fans move it up 7 places.",
      }),
    ).toBe("FSB +7");
  });

  it("leaves no ▲ on the bill or in the key", () => {
    bill();
    expect(document.body.textContent).not.toContain("▲");
    const fresh = {
      ...acts[0],
      reason: "The Lantern Room fans move it into the top 8.",
    };
    expect(markKey(fresh, { acts: [fresh, acts[1]] }).lines).toContain(
      "+ and a number: the places a venue's fans lift an act.",
    );
  });
});
