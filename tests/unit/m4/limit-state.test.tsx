// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import { TracePanel } from "@/components/trace-panel";
import type { TraceCall } from "@/lib/build-events";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";
import { LineupSchema } from "@/lib/lineup";

afterEach(cleanup);

const { acts } = LineupSchema.parse(fixture);
const LIMIT =
  "You've used today's 5 fresh builds from this network. The saved build still replays instantly. Try again tomorrow (UTC).";
const call = (n: number): TraceCall => ({
  n,
  tool: "venue_artists",
  endpoint: "/v2/insights",
  summary: `Call ${n}`,
  params: [],
  resultCount: 50,
  ms: 100,
  cached: true,
});

const replayed: BuildState = {
  ...IDLE_BUILD,
  status: "done",
  acts,
  calls: Array.from({ length: 11 }, (_, i) => call(i + 1)),
  summary: { calls: 11, ms: 1400 },
  build: {
    id: "saved-build",
    createdAt: "2026-10-15T10:28:00.000Z",
    replayed: true,
  },
};

function refused(from: BuildState) {
  let state = buildReducer(from, { type: "start", fresh: true });
  state = buildReducer(state, {
    type: "event",
    event: { type: "error", message: LIMIT },
  });
  return buildReducer(state, {
    type: "event",
    event: { type: "done", calls: 0, ms: 0 },
  });
}

describe("a fresh build refused at the limit", () => {
  it("keeps the board, the trace and the saved build on screen", () => {
    const state = refused(replayed);
    expect(state.acts).toEqual(acts);
    expect(state.calls).toEqual(replayed.calls);
    expect(state.build).toEqual(replayed.build);
    expect(state.status).toBe("done");
  });

  it("keeps the limit message for the trace", () => {
    expect(refused(replayed).refusal).toBe(LIMIT);
  });

  it("keeps the board while the server decides", () => {
    const pending = buildReducer(replayed, { type: "start", fresh: true });
    expect(pending.status).toBe("building");
    expect(pending.acts).toEqual(acts);
  });

  it("also keeps the board when the service can't be reached", () => {
    const pending = buildReducer(replayed, { type: "start", fresh: true });
    const state = buildReducer(pending, {
      type: "fail",
      message: "Couldn't reach the build service. Try again.",
    });
    expect(state.acts).toEqual(acts);
    expect(state.refusal).toBe("Couldn't reach the build service. Try again.");
  });

  it("clears the board once the server accepts the fresh build", () => {
    let state = buildReducer(replayed, { type: "start", fresh: true });
    state = buildReducer(state, {
      type: "event",
      event: {
        type: "build",
        id: "fresh-build",
        createdAt: "2026-10-17T09:00:00.000Z",
        replayed: false,
      },
    });
    expect(state).toMatchObject({
      status: "building",
      acts: [],
      calls: [],
      refusal: null,
    });
    expect(state.build?.id).toBe("fresh-build");
  });

  it("clears an earlier refusal when the next build starts", () => {
    expect(
      buildReducer(refused(replayed), { type: "start", fresh: false }).refusal,
    ).toBeNull();
  });
});

describe("TracePanel after a refusal", () => {
  it("shows the limit message and offers the saved build's replay", () => {
    const onBuild = vi.fn();
    render(<TracePanel state={refused(replayed)} onBuild={onBuild} />);
    expect(screen.getByRole("alert").textContent).toBe(LIMIT);
    fireEvent.click(
      screen.getByRole("button", { name: "Replay the saved build" }),
    );
    expect(onBuild).toHaveBeenCalledWith();
  });

  it("doesn't offer another fresh build while the refusal shows", () => {
    render(<TracePanel state={refused(replayed)} onBuild={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "Run the agent again" }),
    ).toBeNull();
  });
});
