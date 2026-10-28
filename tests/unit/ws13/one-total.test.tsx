// @vitest-environment jsdom
// Daniel, 28 October (17:10): "One call count. The stop line and the page show a single total:
// either everything counted in N, or "after N of its 28 Qloo calls, then M reads of Qloo's
// location signal for the cards (N+M in all)". Never two different totals." Boise's stop line
// said 16 while its trace showed 20: the trace panel's counter shows the stop line's total.
// Invented data only.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TracePanel } from "@/components/trace-panel";
import { stopLine } from "@/lib/agent-words";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";
import {
  FORT,
  LANTERN,
  OPENING,
  read,
  runAgent,
  scriptedModel,
} from "./agent-kit";

afterEach(cleanup);

const FULL = { mid: 0, opener: 0 };

describe("one call count (Daniel, 17:10)", () => {
  it("words the stop line with the location reads after the venues, and their sum", () => {
    expect(
      stopLine({
        reason: "full",
        calls: 16,
        located: 4,
        cap: 28,
        city: "Boise",
        open: FULL,
      }),
    ).toBe(
      "The agent stopped reading venues: every tier is full, after 16 of its 28 Qloo calls, then 4 reads of Qloo's location signal for the cards (20 in all).",
    );
    // With no location reads, everything is counted in N.
    expect(
      stopLine({
        reason: "full",
        calls: 16,
        cap: 28,
        city: "Boise",
        open: FULL,
      }),
    ).toBe(
      "The agent stopped reading venues: every tier is full, after 16 of its 28 Qloo calls.",
    );
  });

  it("gives a run's stop line the trace's own total, and the trace panel's counter shows the same", async () => {
    const { model } = scriptedModel([
      ...OPENING,
      [read("mid", LANTERN), read("opener", LANTERN)],
      [read("mid", FORT), read("opener", FORT)],
      [
        {
          name: "finish",
          input: {
            anchor_venue_ids: [LANTERN, FORT],
            summary: "Two venues filled both tiers.",
            stopped_because: "every_band_full",
          },
        },
      ],
    ]);
    const { events, calls } = await runAgent(model);
    const located = calls.filter(
      (call) => call.tool === "location_signal",
    ).length;
    expect(located).toBe(4);
    const total = calls.length;
    const stopped = events.find((event) => event.type === "stopped");
    expect(stopped?.type === "stopped" && stopped.text).toBe(
      `The agent stopped reading venues: every tier is full, after ${total - located} of its 28 Qloo calls, then 4 reads of Qloo's location signal for the cards (${total} in all).`,
    );

    // The page, from the same events: the trace panel's counter and its closing line.
    const state = events.reduce<BuildState>(
      (board, event) => buildReducer(board, { type: "event", event }),
      { ...IDLE_BUILD, status: "building" },
    );
    render(<TracePanel state={state} onBuild={() => {}} />);
    expect(screen.getByText(`${total} of 28`)).toBeTruthy();
    expect(
      screen.getByText(new RegExp(`^Built with ${total} Qloo calls`)),
    ).toBeTruthy();
    expect(
      screen.getByText(`(${total} in all).`, { exact: false }),
    ).toBeTruthy();
  });
});
