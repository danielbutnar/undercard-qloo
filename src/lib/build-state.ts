import type { BuildEvent, TraceCall } from "./build-events";
import type { FirstBill } from "./first-bill";
import type { Act } from "./lineup";
import type { Replacement, UnavailableReason } from "./unavailable";

export interface BuildState {
  status: "idle" | "building" | "done" | "error";
  /** Qloo calls in call order; parallel calls can arrive out of order. Refill calls follow. */
  calls: TraceCall[];
  /** The call that arrived last, highlighted while a build or refill runs. */
  latest: number | null;
  /** The agent's latest status note. */
  note: string | null;
  /** The planner's own lines, each with how many calls had come back when it was said. */
  notes: { at: number; text: string }[];
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
  /** Why the act being refilled dropped out, until its replacement arrives. */
  refillReason: UnavailableReason | null;
  /** Replacements on the board, by act id: whose slot each took, and why. */
  replaced: Record<string, Replacement>;
  /**
   * The board on screen when a fresh build was asked for. It stays up until the server
   * accepts the build; if the server refuses (a rate limit, a missing key) it comes back.
   */
  kept: BuildState | null;
  /** Why the last fresh build was refused; the trace shows it with the replay as next step. */
  refusal: string | null;
}

export const IDLE_BUILD: BuildState = {
  status: "idle",
  calls: [],
  latest: null,
  note: null,
  notes: [],
  acts: [],
  error: null,
  summary: null,
  build: null,
  unavailable: [],
  refilling: null,
  refillBase: 0,
  refillError: null,
  refillReason: null,
  replaced: {},
  kept: null,
  refusal: null,
};

/** The board the first screen opens on: the saved build's acts, ready to replay or refill. */
export function firstBoard(bill: FirstBill | null): BuildState {
  if (!bill) return IDLE_BUILD;
  return {
    ...IDLE_BUILD,
    acts: bill.acts,
    build: { ...bill.build, replayed: true },
  };
}

export type BuildAction =
  | { type: "start"; fresh?: boolean }
  | { type: "event"; event: BuildEvent }
  | { type: "end" }
  | { type: "fail"; message: string }
  | { type: "markUnavailable"; entityId: string; reason?: UnavailableReason }
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

/** Puts the kept board back, with the reason the fresh build didn't start. */
function restoreKept(state: BuildState, refusal: string): BuildState {
  return { ...state.kept!, kept: null, refusal };
}

function applyRefillEvent(state: BuildState, event: BuildEvent): BuildState {
  switch (event.type) {
    case "call":
      return withCall(state, {
        ...event.call,
        n: state.refillBase + event.call.n,
      });
    case "refill": {
      const gone = state.acts.find((act) => act.entityId === event.replaces);
      return {
        ...state,
        acts: replaceAct(state.acts, event.replaces, event.act),
        replaced: {
          ...state.replaced,
          [event.act.entityId]: {
            name: gone?.name ?? state.replaced[event.replaces]?.name ?? "",
            reason: state.refillReason,
          },
        },
      };
    }
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
    case "start": {
      if (action.fresh && state.acts.length > 0) {
        const board: BuildState = { ...state, kept: null, refusal: null };
        return { ...board, status: "building", kept: board };
      }
      return { ...IDLE_BUILD, status: "building" };
    }
    case "fail":
      if (state.kept) return restoreKept(state, action.message);
      return { ...state, status: "error", error: action.message };
    case "end":
      if (state.kept)
        return restoreKept(
          state,
          state.refusal ?? "The build stopped before it started. Try again.",
        );
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
        refillReason: action.reason ?? null,
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
          // The server accepted the build: a kept board gives way to the new one.
          if (state.kept) {
            return {
              ...IDLE_BUILD,
              status: "building",
              build: {
                id: event.id,
                createdAt: event.createdAt,
                replayed: event.replayed,
              },
            };
          }
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
          return {
            ...state,
            note: event.text,
            notes: event.planner
              ? [...state.notes, { at: state.calls.length, text: event.text }]
              : state.notes,
          };
        case "lineup":
          return { ...state, acts: event.lineup.acts };
        case "refill":
          return {
            ...state,
            acts: replaceAct(state.acts, event.replaces, event.act),
          };
        case "error":
          if (state.kept) return { ...state, refusal: event.message };
          return { ...state, error: event.message };
        case "done":
          if (state.kept)
            return restoreKept(
              state,
              state.refusal ?? "The build didn't start. Try again.",
            );
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
