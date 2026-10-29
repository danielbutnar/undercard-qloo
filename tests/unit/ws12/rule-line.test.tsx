// @vitest-environment jsdom
// WS12 item 7 (WS8's item 17): "NEW" is defined in the poster's rule line, beside "↑", where a
// reader looks for what the marks mean, and said once: the poster's last line no longer repeats
// it. Synthetic data: invented acts and venues (the fixture's Low Bench Choir is NEW).
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NEW_KEY,
  RULE_LINE,
  ruleLine,
} from "@/components/chart/poster-words";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the poster's rule line (WS12 item 7)", () => {
  it("defines NEW right after ↑ when an act is new to the top 50", () => {
    expect(NEW_KEY).toBe("NEW = rose into Qloo's top 50");
    expect(ruleLine(true)).toBe(
      "↑ = places it rose in Qloo's ranking with that venue's fans (5+ to qualify); NEW = rose into Qloo's top 50; the strongest Qloo match takes each slot",
    );
    expect(ruleLine(false)).toBe(RULE_LINE);
  });

  it("says it once on the poster: in the rule line, not again at its foot", () => {
    const { container } = render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    expect(container.querySelector(".poster-rule")?.textContent).toContain(
      NEW_KEY,
    );
    expect(container.querySelector(".poster-foot")?.textContent).toBe(
      "Fictional demo festival",
    );
  });
});
