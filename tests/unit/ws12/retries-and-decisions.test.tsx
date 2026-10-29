// @vitest-environment jsdom
// Daniel, 2026-10-28 (19:10 and 19:20), on WS12's surfaces: every place the agent skipped and
// every stop it refused is a decision line on the setlist, reading cleanly on its own; and
// wherever the page states a build's Qloo call count, it says so when there were retries
// ("20 Qloo calls, plus 2 retries"), counted from the trace (WS13's retried field), never left
// silent. Synthetic data: invented acts and venues, no Qloo data.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRetryCount,
  setlistCue,
  setlistLines,
} from "@/components/chart/setlist-words";
import { callWords, watchCallLine } from "@/components/chart/words";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodPage } from "@/components/method-page";
import { refusedLine, skippedLine } from "@/lib/agent-words";
import type { TraceCall } from "@/lib/build-events";
import { methodStory } from "@/lib/method-story";
import { billPlaces } from "@/lib/places";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const saved = syntheticSavedBuild();
// The saved build's trace with two retries on its third call and one on its eighth.
const RETRIED: TraceCall[] = saved.trace.map((call) =>
  call.n === 3
    ? { ...call, retried: [503, 429] }
    : call.n === 8
      ? { ...call, retried: [503] }
      : call,
);
const SKIPPED = skippedLine(
  "Sagebrush Diner",
  "a restaurant with no stage, not a music room",
);
const REFUSED = refusedLine(1, ["Venue 227"]);
const BILL = {
  ...FIRST_BILL,
  places: billPlaces(saved.lineup.acts, saved.context.baselines),
  trace: RETRIED,
  notes: [
    ...(saved.notes ?? []),
    { at: 4, text: SKIPPED },
    { at: 6, text: REFUSED },
  ],
};

describe("the agent's decision lines on the setlist (Daniel, 19:10 and 19:20)", () => {
  it("read on their own, without the agent's cue in front", () => {
    expect(setlistCue(SKIPPED)).toBe(
      "Skipped Sagebrush Diner: listed by Qloo, but a restaurant with no stage, not a music venue",
    );
    expect(setlistCue(REFUSED)).toBe(REFUSED);
    // A place's own words keep their bands: only a fee band is a tier.
    expect(
      setlistCue(skippedLine("Pine Hall", "a rehearsal space for bands")),
    ).toBe(
      "Skipped Pine Hall: listed by Qloo, but a rehearsal space for bands",
    );
    // The planner's other lines keep their cue.
    expect(setlistCue("Try Venue 227 next.")).toBe(
      "The AI agent: Try Venue 227 next.",
    );
  });

  it("each show on the setlist, where the agent decided", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={BILL} />);
    const sheet = screen.getByRole("region", {
      name: "The AI agent's setlist",
    });
    const text = sheet.textContent ?? "";
    expect(text).toContain(setlistCue(SKIPPED));
    expect(text).toContain(REFUSED);
    expect(text).not.toContain("The AI agent: Skipped");
    expect(text).not.toContain("The AI agent: Tried to stop");
  });
});

describe("retries beside every call count (Daniel, 19:20)", () => {
  it("counts the build's own retries from the trace, apart from a refill's", () => {
    const { lines } = setlistLines(
      [
        ...RETRIED,
        {
          ...RETRIED[0],
          n: RETRIED.length + 1,
          tool: "refill",
          retried: [503],
        },
      ],
      { venues: [], bands: SAGEBRUSH_SOUND.feeBands },
    );
    expect(buildRetryCount(lines)).toBe(3);
  });

  it("says them on the setlist's count and the drafted line", () => {
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={BILL} />);
    const sheet = screen.getByRole("region", {
      name: "The AI agent's setlist",
    });
    expect(sheet.textContent).toContain(
      `${RETRIED.length} Qloo calls, plus 3 retries`,
    );
    expect(
      screen.getByText(/^Drafted from \d+ Qloo calls/).textContent,
    ).toMatch(
      /^Drafted from \d+ Qloo calls the AI agent planned, plus 3 retries · /,
    );
  });

  it("says none where there were none", () => {
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{ ...BILL, trace: saved.trace }}
      />,
    );
    const sheet = screen.getByRole("region", {
      name: "The AI agent's setlist",
    });
    expect(sheet.textContent).not.toMatch(/retr/);
    expect(screen.getByText(/^Drafted from/).textContent).not.toMatch(/retr/);
  });

  it("says a call's own retries on Watch's line for it", () => {
    expect(watchCallLine({ ...RETRIED[2], resultCount: 50 }, 12)).toMatch(
      /^Qloo call 3 of 12: .+ · 50 results, plus 2 retries$/,
    );
    expect(watchCallLine({ ...RETRIED[1], resultCount: 50 }, 12)).not.toMatch(
      /retr/,
    );
  });

  it("says them on How it works' AI agent pass", () => {
    const story = methodStory(SAGEBRUSH_SOUND, BILL)!;
    render(<MethodPage story={story} />);
    const passes = within(
      screen.getByRole("region", { name: "Who does what" }),
    ).getAllByRole("listitem");
    expect(passes[0].getAttribute("aria-label")).toBe(
      `The AI agent: plans the ${BILL.calls} Qloo calls, plus 3 retries`,
    );
    expect(passes[0].textContent).toContain("plus 3 retries");
    expect(
      screen.getByRole("region", { name: "The AI agent's choices" })
        .textContent,
    ).toContain(`in ${BILL.calls} Qloo calls, plus 3 retries. Here`);
  });
});

describe("a saved trace line's control, as the page shows it (Daniel, 29 Oct, 09:45)", () => {
  it("says venue where the saved line says room, and keeps the rest", () => {
    // The 29 saved re-run builds' trace text, which is never edited.
    expect(
      callWords(
        "Mid-band artists for the headliners and Strada Hall, a room in Bucharest with similar Qloo popularity, the control for Venue 227",
      ),
    ).toBe(
      "Mid-size artists for the headliners and Strada Hall, a venue in Bucharest with similar Qloo popularity, the control for Venue 227",
    );
    expect(
      callWords(
        "Bucharest places tagged Live music venue, to find each venue's control: a room in Bucharest with similar Qloo popularity",
      ),
    ).toBe(
      "Bucharest places tagged Live music venue, to find each venue's control: a venue in Bucharest with similar Qloo popularity",
    );
    // A venue's own name keeps its words.
    expect(callWords("Mid-band artists for The Lantern Room")).toBe(
      "Mid-size artists for The Lantern Room",
    );
  });
});
