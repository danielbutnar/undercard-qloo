// WS2, first step: Watch's banner speaks from src/components/chart/words.ts, with the same
// strings EditionBanner held in festival-screen.tsx, so the first-screen redesign can reuse them.
import { describe, expect, it } from "vitest";
import {
  AGENT_DECIDES,
  agentLine,
  watchCallLine,
  watchLine,
  watchTicksLabel,
  watchTitle,
} from "@/components/chart/words";
import type { ClimbEvent } from "@/lib/lift-climb";

const HEADLINERS = ["Khruangbin", "Japanese Breakfast"];
const venue = { entityId: "v-1", name: "The Lantern Room" };
const act = (n: number, move: number | null) => ({
  entityId: `a-${n}`,
  name: `Act ${n}`,
  move,
});
const step = (
  acts: ClimbEvent["acts"],
  at: ClimbEvent["venue"] = venue,
): ClimbEvent => ({ type: "climb", band: "mid", venue: at, acts });

describe("Watch's banner, in words", () => {
  it("titles the first edition, a venue's edition and the headliners' own", () => {
    const base = { first: true, step: null, headliners: HEADLINERS };
    expect(watchTitle({ ...base, replayed: true })).toBe(
      "Replaying the AI agent's build",
    );
    expect(watchTitle({ ...base, replayed: false })).toBe(
      "The AI agent is planning its Qloo calls",
    );
    expect(
      watchTitle({
        first: false,
        step: step([act(1, 7)]),
        replayed: true,
        headliners: HEADLINERS,
      }),
    ).toBe("+ The Lantern Room's fans");
    expect(
      watchTitle({
        first: false,
        step: step([act(1, null)], null),
        replayed: true,
        headliners: HEADLINERS,
      }),
    ).toBe("Khruangbin + Japanese Breakfast fans alone");
  });

  it("says what each edition shows, before and after the lineup is in", () => {
    expect(watchLine({ first: true, step: null, lifted: null })).toBe(
      "First it finds the headliners and the town's music venues in Qloo.",
    );
    expect(
      watchLine({
        first: false,
        step: step([act(1, null)], null),
        lifted: null,
      }),
    ).toBe(
      "Qloo ranks the artists the headliners' fans like: the chart before any venue.",
    );
    const two = step([act(1, 7), act(2, null), act(3, 9)]);
    expect(watchLine({ first: false, step: two, lifted: null })).toBe(
      "Qloo's ranking re-sorts with this venue's fans added: 2 of the top 3 climb 5 places or more.",
    );
    expect(
      watchLine({ first: false, step: step([act(1, 7)]), lifted: null }),
    ).toBe(
      "Qloo's ranking re-sorts with this venue's fans added: 1 of the top 1 climbs 5 places or more.",
    );
    expect(
      watchLine({ first: false, step: step([act(1, null)]), lifted: null }),
    ).toBe(
      "Qloo's ranking re-sorts with this venue's fans added: no act in view climbs 5 places.",
    );
    expect(watchLine({ first: false, step: two, lifted: 3 })).toBe(
      "Qloo's ranking re-sorts with this venue's fans added: 3 acts climb onto the lineup.",
    );
    expect(watchLine({ first: false, step: two, lifted: 1 })).toBe(
      "Qloo's ranking re-sorts with this venue's fans added: 1 act climbs onto the lineup.",
    );
    expect(watchLine({ first: false, step: two, lifted: 0 })).toBe(
      "Qloo's ranking re-sorts with this venue's fans added: no act climbs 5 places onto the lineup.",
    );
  });

  it("names the Qloo call, the ticks, and the AI agent's line or what it decides", () => {
    const call = {
      n: 8,
      summary: "Mid-band artists for the headliners and The Lantern Room",
    };
    expect(watchCallLine({ ...call, resultCount: 50 }, 12)).toBe(
      "Qloo call 8 of 12: Mid-tier artists for the headliners and The Lantern Room · 50 results",
    );
    expect(watchCallLine({ ...call, resultCount: null }, 12)).toBe(
      "Qloo call 8 of 12: Mid-tier artists for the headliners and The Lantern Room",
    );
    expect(watchTicksLabel(3, 12)).toBe("3 of 12 Qloo calls in");
    // WS2 (b): the label became "The AI agent's plan:".
    expect(agentLine("Try Cottonwood Social Hall for Mid.")).toBe(
      "The AI agent's plan: Try Cottonwood Social Hall for Mid.",
    );
    expect(AGENT_DECIDES).toBe(
      "The AI agent chose which venues to read, and in what order; Qloo's numbers and the rule pick the acts.",
    );
  });
});
