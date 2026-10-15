import { describe, expect, it } from "vitest";
import { buildReducer, IDLE_BUILD } from "@/lib/build-state";

describe("buildReducer: saved builds", () => {
  it("remembers which build the board came from and whether it was replayed", () => {
    const started = buildReducer(IDLE_BUILD, { type: "start" });
    const state = buildReducer(started, {
      type: "event",
      event: {
        type: "build",
        id: "build-1",
        createdAt: "2026-10-15T14:02:00.000Z",
        replayed: true,
      },
    });
    expect(state.build).toEqual({
      id: "build-1",
      createdAt: "2026-10-15T14:02:00.000Z",
      replayed: true,
    });
  });

  it("forgets the previous build when a new one starts", () => {
    const withBuild = {
      ...IDLE_BUILD,
      build: { id: "old", createdAt: "", replayed: false },
    };
    expect(buildReducer(withBuild, { type: "start" }).build).toBeNull();
  });
});
