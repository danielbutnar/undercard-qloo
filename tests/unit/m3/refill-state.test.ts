import { describe, expect, it } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import type { TraceCall } from "@/lib/build-events";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";
import { LineupSchema } from "@/lib/lineup";

const { acts } = LineupSchema.parse(fixture);
const call = (n: number, tool = "venue_artists"): TraceCall => ({
  n,
  tool,
  endpoint: "/v2/insights",
  summary: `Call ${n}`,
  params: [],
  resultCount: 50,
  ms: 100,
  cached: false,
});

const built: BuildState = {
  ...IDLE_BUILD,
  status: "done",
  acts,
  calls: Array.from({ length: 12 }, (_, i) => call(i + 1)),
  build: {
    id: "build-1",
    createdAt: "2026-10-15T14:02:00.000Z",
    replayed: false,
  },
};
const gone = acts[1];
const replacement = {
  ...acts[1],
  entityId: "00000000-0000-4000-8000-000000000999",
  name: "Synthetic Replacement",
};

describe("buildReducer: refills", () => {
  it("marks an act unavailable and starts its refill", () => {
    const state = buildReducer(built, {
      type: "markUnavailable",
      entityId: gone.entityId,
    });
    expect(state.unavailable).toEqual([gone.entityId]);
    expect(state.refilling).toBe(gone.entityId);
  });

  it("numbers refill calls after the build's calls", () => {
    let state = buildReducer(built, {
      type: "markUnavailable",
      entityId: gone.entityId,
    });
    state = buildReducer(state, {
      type: "refillEvent",
      event: { type: "call", call: call(1, "refill") },
    });
    expect(state.calls.at(-1)).toMatchObject({ n: 13, tool: "refill" });
    expect(state.latest).toBe(13);
  });

  it("swaps the replacement into the unavailable act's slot", () => {
    let state = buildReducer(built, {
      type: "markUnavailable",
      entityId: gone.entityId,
    });
    state = buildReducer(state, {
      type: "refillEvent",
      event: { type: "refill", replaces: gone.entityId, act: replacement },
    });
    state = buildReducer(state, {
      type: "refillEvent",
      event: { type: "done", calls: 1, ms: 900 },
    });
    expect(state.acts[1]).toEqual(replacement);
    expect(state.acts).toHaveLength(10);
    expect(state.refilling).toBeNull();
  });

  it("keeps the stamped act and reports why when no replacement is found", () => {
    let state = buildReducer(built, {
      type: "markUnavailable",
      entityId: gone.entityId,
    });
    state = buildReducer(state, {
      type: "refillEvent",
      event: { type: "error", message: "No other Mid act is left." },
    });
    state = buildReducer(state, {
      type: "refillEvent",
      event: { type: "done", calls: 3, ms: 900 },
    });
    expect(state.acts[1]).toEqual(gone);
    expect(state.refillError).toBe("No other Mid act is left.");
    expect(state.refilling).toBeNull();
  });

  it("reports a refill stream that closes early", () => {
    let state = buildReducer(built, {
      type: "markUnavailable",
      entityId: gone.entityId,
    });
    state = buildReducer(state, { type: "refillEnd" });
    expect(state.refilling).toBeNull();
    expect(state.refillError).toBe(
      "The refill stopped before it finished. Try again.",
    );
  });

  it("starts a new build with nothing marked unavailable", () => {
    const marked = buildReducer(built, {
      type: "markUnavailable",
      entityId: gone.entityId,
    });
    expect(buildReducer(marked, { type: "start" }).unavailable).toEqual([]);
  });
});
