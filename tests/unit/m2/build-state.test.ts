import { describe, expect, it } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import type { TraceCall } from "@/lib/build-events";
import { buildReducer, IDLE_BUILD, takeLines } from "@/lib/build-state";
import { LineupSchema } from "@/lib/lineup";

const lineup = LineupSchema.parse(fixture);

const call = (n: number, overrides: Partial<TraceCall> = {}): TraceCall => ({
  n,
  tool: "search_artist",
  endpoint: "/search",
  summary: `Call ${n}`,
  params: [{ key: "query", value: "Synthetic" }],
  resultCount: 3,
  ms: 300,
  cached: false,
  ...overrides,
});

const started = buildReducer(IDLE_BUILD, { type: "start" });

describe("buildReducer", () => {
  it("starts a build with an empty trace and board", () => {
    const withActs = { ...IDLE_BUILD, acts: lineup.acts };
    expect(buildReducer(withActs, { type: "start" })).toMatchObject({
      status: "building",
      calls: [],
      acts: [],
    });
  });

  it("lists calls by number, however they arrive, and marks the latest arrival", () => {
    let state = buildReducer(started, {
      type: "event",
      event: { type: "call", call: call(3) },
    });
    state = buildReducer(state, {
      type: "event",
      event: { type: "call", call: call(1) },
    });
    expect(state.calls.map((c) => c.n)).toEqual([1, 3]);
    expect(state.latest).toBe(1);
  });

  it("keeps the agent's latest status note", () => {
    const state = buildReducer(started, {
      type: "event",
      event: { type: "status", text: "Anchors chosen." },
    });
    expect(state.note).toBe("Anchors chosen.");
  });

  it("fills the board from the lineup and finishes on done", () => {
    let state = buildReducer(started, {
      type: "event",
      event: { type: "lineup", lineup },
    });
    state = buildReducer(state, {
      type: "event",
      event: { type: "done", calls: 11, ms: 15000 },
    });
    expect(state.acts).toHaveLength(10);
    expect(state).toMatchObject({
      status: "done",
      summary: { calls: 11, ms: 15000 },
    });
  });

  it("ends in error when the build reported one", () => {
    let state = buildReducer(started, {
      type: "event",
      event: { type: "error", message: "Qloo isn't configured." },
    });
    state = buildReducer(state, {
      type: "event",
      event: { type: "done", calls: 0, ms: 5 },
    });
    expect(state).toMatchObject({
      status: "error",
      error: "Qloo isn't configured.",
    });
  });

  it("treats a stream that closes before done as an interrupted build", () => {
    const state = buildReducer(started, { type: "end" });
    expect(state).toMatchObject({
      status: "error",
      error: "The build stopped before it finished. Try again.",
    });
  });

  it("reports a failed request", () => {
    const state = buildReducer(started, {
      type: "fail",
      message: "Couldn't reach the build service.",
    });
    expect(state).toMatchObject({
      status: "error",
      error: "Couldn't reach the build service.",
    });
  });
});

describe("takeLines", () => {
  it("splits complete lines and keeps a partial one for the next chunk", () => {
    expect(takeLines('{"a":1}\n{"b":2}\n{"c"')).toEqual({
      lines: ['{"a":1}', '{"b":2}'],
      rest: '{"c"',
    });
  });

  it("skips blank lines", () => {
    expect(takeLines("\n\n{}\n")).toEqual({ lines: ["{}"], rest: "" });
  });
});
