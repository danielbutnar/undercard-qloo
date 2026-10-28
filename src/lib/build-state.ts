import type { StopLine } from "./agent-words";
import type { ClimbEvent } from "./lift-climb";
import type { RunningSlot } from "./running-order";
import type { BuildEvent, TraceCall } from "./build-events";
import type { FirstBill } from "./first-bill";
import type { Act } from "./lineup";
import type { LocalPick } from "./local-pick";
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
  /** The error's code, when the server named the state it belongs to. */
  errorCode: string | null;
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
  /** The refusal's code, when the server gave one ("limit": the day's live runs are used). */
  refusalCode: string | null;
  /** Acts the buyer keeps (M8c): a redraft refills every other slot. */
  keeping: string[];
  /** A redraft is running; it shares the refill's trace numbering and error line. */
  redrafting: boolean;
  /** The running order for the acts on the bill (M8a); dropped when the bill changes. */
  order: RunningSlot[] | null;
  /** A running order is being scored; it shares the refill's trace numbering. */
  ordering: boolean;
  /** The lift, visible (M9a): each band's list after each baseline and venue call. */
  climbs: ClimbEvent[];
  /** Why the agent stopped reading venues (WS13.2); a 1.0 replay has none. */
  stopped: StopLine | null;
  /** The AI's local picks for the buyer to check (WS13.5); none on a 1.0 build. */
  localPicks: LocalPick[];
  /** The local picks the buyer added to the bill, by entity id. */
  added: string[];
}

export const IDLE_BUILD: BuildState = {
  status: "idle",
  calls: [],
  latest: null,
  note: null,
  notes: [],
  acts: [],
  error: null,
  errorCode: null,
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
  refusalCode: null,
  keeping: [],
  redrafting: false,
  order: null,
  ordering: false,
  climbs: [],
  stopped: null,
  localPicks: [],
  added: [],
};

/** The board the first screen opens on: the saved build's acts, ready to replay or refill. */
export function firstBoard(bill: FirstBill | null): BuildState {
  if (!bill) return IDLE_BUILD;
  return {
    ...IDLE_BUILD,
    acts: bill.acts,
    build: { ...bill.build, replayed: true },
    localPicks: bill.localPicks ?? [],
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
  | { type: "refillFail"; message: string }
  | { type: "toggleKeep"; entityId: string }
  | { type: "toggleLocal"; entityId: string }
  | { type: "startRedraft" }
  | { type: "startOrder" }
  | { type: "closeOrder" };

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
  return {
    ...state.kept!,
    kept: null,
    refusal,
    refusalCode: state.refusalCode,
  };
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
        order: null,
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
    case "running-order":
      return { ...state, order: event.slots };
    case "redraft": {
      let acts = state.acts;
      const replaced = { ...state.replaced };
      for (const { replaces, act } of event.pairs) {
        const gone = acts.find((entry) => entry.entityId === replaces);
        acts = replaceAct(acts, replaces, act);
        replaced[act.entityId] = {
          name: gone?.name ?? state.replaced[replaces]?.name ?? "",
          reason: null,
        };
      }
      return { ...state, acts, replaced, order: null };
    }
    case "error":
      return { ...state, refillError: event.message };
    case "done":
      return { ...state, refilling: null, redrafting: false, ordering: false };
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
        const board: BuildState = {
          ...state,
          kept: null,
          refusal: null,
          refusalCode: null,
          climbs: [],
        };
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
    case "toggleLocal":
      return {
        ...state,
        added: state.added.includes(action.entityId)
          ? state.added.filter((id) => id !== action.entityId)
          : [...state.added, action.entityId],
      };
    case "toggleKeep":
      return {
        ...state,
        keeping: state.keeping.includes(action.entityId)
          ? state.keeping.filter((id) => id !== action.entityId)
          : [...state.keeping, action.entityId],
      };
    case "startOrder":
      return {
        ...state,
        ordering: true,
        refillBase: state.calls.length,
        refillError: null,
      };
    case "closeOrder":
      return { ...state, order: null };
    case "startRedraft":
      return {
        ...state,
        redrafting: true,
        refillBase: state.calls.length,
        refillError: null,
        refillReason: null,
      };
    case "markUnavailable":
      return {
        ...state,
        keeping: state.keeping.filter((id) => id !== action.entityId),
        unavailable: [...new Set([...state.unavailable, action.entityId])],
        refilling: action.entityId,
        refillBase: state.calls.length,
        refillError: null,
        refillReason: action.reason ?? null,
      };
    case "refillEvent":
      return applyRefillEvent(state, action.event);
    case "refillEnd":
      return state.refilling || state.redrafting || state.ordering
        ? {
            ...state,
            refilling: null,
            redrafting: false,
            ordering: false,
            refillError:
              state.refillError ??
              "The refill stopped before it finished. Try again.",
          }
        : state;
    case "refillFail":
      return {
        ...state,
        refilling: null,
        redrafting: false,
        ordering: false,
        refillError: action.message,
      };
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
        case "climb":
          return { ...state, climbs: [...state.climbs, event] };
        case "stopped":
          return {
            ...state,
            stopped: { reason: event.reason, text: event.text },
          };
        case "local-pick":
          return { ...state, localPicks: event.picks };
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
        case "redraft":
        case "running-order":
          return applyRefillEvent(state, event);
        case "error":
          if (state.kept)
            return {
              ...state,
              refusal: event.message,
              refusalCode: event.code ?? null,
            };
          return {
            ...state,
            error: event.message,
            errorCode: event.code ?? null,
          };
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
