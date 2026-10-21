// A fresh run refused while a board is on screen puts the board back with the refusal's words;
// it keeps the refusal's code too, so the screen can tell the day's live-run limit from a
// passing failure.
import { describe, expect, it } from "vitest";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";

const board: BuildState = {
  ...IDLE_BUILD,
  status: "error",
  error: "Some slots stayed open.",
  errorCode: "not-full",
  acts: [
    {
      entityId: "a",
      name: "A",
      band: "opener",
      popularity: 0.7,
      affinity: 0.8,
      sharedTags: [
        { id: "urn:tag:genre:music:indie_pop", name: "Indie Pop" },
        { id: "urn:tag:genre:music:rock", name: "Rock" },
      ],
      anchorVenue: { entityId: "v", name: "V" },
      reason: "V fans move it up 9 places.",
    },
  ],
  build: {
    id: "run-1",
    createdAt: "2026-10-21T08:00:00.000Z",
    replayed: false,
  },
};

describe("a refused fresh run", () => {
  it("puts the board back with the refusal's words and its code", () => {
    let state = buildReducer(board, { type: "start", fresh: true });
    state = buildReducer(state, {
      type: "event",
      event: {
        type: "error",
        code: "limit",
        message: "Today's live runs from this connection are used.",
      },
    });
    state = buildReducer(state, {
      type: "event",
      event: { type: "done", calls: 0, ms: 0 },
    });
    expect(state.acts).toEqual(board.acts);
    expect(state.errorCode).toBe("not-full");
    expect(state.refusal).toBe(
      "Today's live runs from this connection are used.",
    );
    expect(state.refusalCode).toBe("limit");
    // The next run starts clean.
    expect(
      buildReducer(state, { type: "start", fresh: true }).refusalCode,
    ).toBeNull();
  });

  it("has no code when the build service couldn't be reached", () => {
    let state = buildReducer(board, { type: "start", fresh: true });
    state = buildReducer(state, {
      type: "fail",
      message: "Couldn't reach the build service. Try again.",
    });
    expect(state.acts).toEqual(board.acts);
    expect(state.refusal).toBe("Couldn't reach the build service. Try again.");
    expect(state.refusalCode).toBeNull();
  });
});
