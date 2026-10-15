import type { BuildEvent, TraceCall } from "./build-events";
import type { Act } from "./lineup";

export interface BuildState {
  status: "idle" | "building" | "done" | "error";
  /** Qloo calls in call order; parallel calls can arrive out of order. Refill calls follow. */
  calls: TraceCall[];
  /** The call that arrived last, highlighted while a build or refill runs. */
  latest: number | null;
  /** The agent's latest status note. */
  note: string | null;
  acts: Act[];
  error: string | null;
  summary: { calls: number; ms: number } | null;
  /** The build this board came from; a replayed build was saved earlier and streamed again. */
  build: { id: string; createdAt: string; replayed: boolean } | null;
  /** Acts the buyer marked unavailable. */
  unavailable: string[];
  /** The act whose slot is being refilled, if any. */
  refilling: string | null;
  /** Calls on the trace when the running refill started; its calls number on from here. */
  refillBase: number;
  refillError: string | null;
}

export const IDLE_BUILD: BuildState = {
  status: "idle",
  calls: [],
  latest: null,
  note: null,
  acts: [],
  error: null,
  summary: null,
  build: null,
  unavailable: [],
  refilling: null,
  refillBase: 0,
  refillError: null,
};

export type BuildAction =
  | { type: "start" }
  | { type: "event"; event: BuildEvent }
  | { type: "end" }
  | { type: "fail"; message: string }
  | { type: "markUnavailable"; entityId: string }
  | { type: "refillEvent"; event: BuildEvent }
  | { type: "refillEnd" }
  | { type: "refillFail"; message: string };

function withCall(state: BuildState, call: TraceCall): BuildState {
  return {
    ...state,
    calls: [...state.calls.filter((other) => other.n !== call.n), call].sort(
      (a, b) => a.n - b.n,
    ),
    latest: call.n,
  };
}

function replaceAct(acts: Act[], replaces: string, act: Act): Act[] {
  return acts.map((current) => (current.entityId === replaces ? act : current));
}

function applyRefillEvent(state: BuildState, event: BuildEvent): BuildState {
  switch (event.type) {
    case "call":
      return withCall(state, {
        ...event.call,
        n: state.refillBase + event.call.n,
      });
    case "refill":
      return {
        ...state,
        acts: replaceAct(state.acts, event.replaces, event.act),
      };
    case "error":
      return { ...state, refillError: event.message };
    case "done":
      return { ...state, refilling: null };
    default:
      return state;
  }
}

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
    case "markUnavailable":
      return {
        ...state,
        unavailable: [...new Set([...state.unavailable, action.entityId])],
        refilling: action.entityId,
        refillBase: state.calls.length,
        refillError: null,
      };
    case "refillEvent":
      return applyRefillEvent(state, action.event);
    case "refillEnd":
      return state.refilling
        ? {
            ...state,
            refilling: null,
            refillError:
              state.refillError ??
              "The refill stopped before it finished. Try again.",
          }
        : state;
    case "refillFail":
      return { ...state, refilling: null, refillError: action.message };
    case "event": {
      const { event } = action;
      switch (event.type) {
        case "build":
          return {
            ...state,
            build: {
              id: event.id,
              createdAt: event.createdAt,
              replayed: event.replayed,
            },
          };
        case "call":
          return withCall(state, event.call);
        case "status":
          return { ...state, note: event.text };
        case "lineup":
          return { ...state, acts: event.lineup.acts };
        case "refill":
          return {
            ...state,
            acts: replaceAct(state.acts, event.replaces, event.act),
          };
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
