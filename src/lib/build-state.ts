import type { BuildEvent, TraceCall } from "./build-events";
import type { Act } from "./lineup";

export interface BuildState {
  status: "idle" | "building" | "done" | "error";
  /** Qloo calls in call order; parallel calls can arrive out of order. */
  calls: TraceCall[];
  /** The call that arrived last, highlighted while the build runs. */
  latest: number | null;
  /** The agent's latest status note. */
  note: string | null;
  acts: Act[];
  error: string | null;
  summary: { calls: number; ms: number } | null;
}

export const IDLE_BUILD: BuildState = {
  status: "idle",
  calls: [],
  latest: null,
  note: null,
  acts: [],
  error: null,
  summary: null,
};

export type BuildAction =
  | { type: "start" }
  | { type: "event"; event: BuildEvent }
  | { type: "end" }
  | { type: "fail"; message: string };

export function buildReducer(
  state: BuildState,
  action: BuildAction,
): BuildState {
  switch (action.type) {
    case "start":
      return { ...IDLE_BUILD, status: "building" };
    case "fail":
      return { ...state, status: "error", error: action.message };
    case "end":
      return state.status === "building"
        ? {
            ...state,
            status: "error",
            error:
              state.error ?? "The build stopped before it finished. Try again.",
          }
        : state;
    case "event": {
      const { event } = action;
      switch (event.type) {
        case "call":
          return {
            ...state,
            calls: [
              ...state.calls.filter((call) => call.n !== event.call.n),
              event.call,
            ].sort((a, b) => a.n - b.n),
            latest: event.call.n,
          };
        case "status":
          return { ...state, note: event.text };
        case "lineup":
          return { ...state, acts: event.lineup.acts };
        case "error":
          return { ...state, error: event.message };
        case "done":
          return {
            ...state,
            status: state.error ? "error" : "done",
            summary: { calls: event.calls, ms: event.ms },
          };
      }
    }
  }
}

/** Splits a streamed NDJSON buffer into complete lines and the unfinished remainder. */
export function takeLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts.filter((line) => line.trim() !== ""), rest };
}
