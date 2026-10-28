"use client";

import { useEffect, useRef, useState } from "react";
import type { TraceCall } from "@/lib/build-events";
import type { BuildState } from "@/lib/build-state";
import { callWords } from "@/components/chart/words";

const CALL_CAP = 12;

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const savedAt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export type BuildRequest = { fresh?: boolean };

/** The yellow Watch button's class, shared with screens that place it themselves. */
export const WATCH_BUTTON = "watch";

/** One of the planner's lines, printed in the trace where it was said. */
function PlannerLine({ text }: { text: string }) {
  return (
    <p className="trace-note">
      <span className="font-bold">Agent: </span>
      {text}
    </p>
  );
}

// The newest call shows its parameters as it streams in; the rest fold behind a toggle. The
// shortlist (WS4) lists its calls with the same row.
export function CallRow({
  call,
  highlighted,
  before = [],
  after = [],
}: {
  call: TraceCall;
  highlighted: boolean;
  /** The planner's lines said before this call. */
  before?: string[];
  /** The planner's lines said after the last call. */
  after?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const showParams = highlighted || expanded;
  const count = call.resultCount ?? "—";
  return (
    <li className={`trace-call ${highlighted ? "is-live" : ""}`}>
      {before.map((text, index) => (
        <PlannerLine key={index} text={text} />
      ))}
      <div className="trace-call-head">
        <p className="trace-summary">
          {call.n}. {callWords(call.summary)}
        </p>
        <p aria-label={`${count} results`} className="trace-count">
          {count}
        </p>
      </div>
      <div className="trace-meta">
        <p>
          GET {call.endpoint} · {seconds(call.ms)}
          {call.cached ? " · cached" : ""}
          {call.retried?.length
            ? ` · retried${call.retried.length > 1 ? ` ${call.retried.length}×` : ""} after ${[...new Set(call.retried)].join(", ")}`
            : ""}
        </p>
        {!highlighted && call.params.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="link"
          >
            Parameters
          </button>
        )}
      </div>
      {showParams && (
        <ul className="trace-params">
          {call.params.map((param) => (
            <li key={param.key}>
              <code>
                {param.key}={param.value}
              </code>
            </li>
          ))}
        </ul>
      )}
      {call.error && <p className="alert">{call.error}</p>}
      {after.map((text, index) => (
        <PlannerLine key={index} text={text} />
      ))}
    </li>
  );
}

/**
 * Every Qloo call the AI agent makes, with its parameters and result count, and the agent's own
 * lines where it said them. Folded on the first screen until Watch replays the saved build.
 */
export function TracePanel({
  state,
  savedCalls,
  replay = true,
  onBuild,
  button = true,
  live = true,
}: {
  state: BuildState;
  /** Qloo calls in the saved build the first screen shows, for the replay's description. */
  savedCalls?: number;
  /** False on a judge's own run, which is never saved: nothing offers to replay it. */
  replay?: boolean;
  onBuild: (request?: BuildRequest) => void;
  /** False when the screen places the Watch button itself (FestivalScreen). */
  button?: boolean;
  /** False where the setlist's Play it live offers the live run (WS12 item 1). */
  live?: boolean;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const building = state.status === "building";
  const busy =
    building || state.refilling !== null || state.redrafting || state.ordering;
  const buildCalls = state.calls.filter(
    (call) =>
      call.tool !== "refill" &&
      call.tool !== "redraft" &&
      call.tool !== "running_order",
  ).length;
  // The first screen shows a saved build: the panel pitches its replay until one runs. A
  // refill's calls list below the pitch.
  const folded =
    state.status === "idle" && state.build !== null && buildCalls === 0;
  const refillCalls = state.calls.length - buildCalls;
  // Calls after the build: refills, a redraft or the running order, named by what they were.
  const onlyRefills = state.calls.every(
    (call) => call.tool !== "redraft" && call.tool !== "running_order",
  );
  const refillCount = `${refillCalls} ${onlyRefills ? "refill " : "more "}${refillCalls === 1 ? "call" : "calls"}`;
  const refillingName = state.acts.find(
    (act) => act.entityId === state.refilling,
  )?.name;

  // Keep the newest call in view as the trace grows.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [state.calls.length]);

  return (
    <aside aria-label="Qloo calls" className="panel trace">
      {button && (
        <button
          type="button"
          onClick={() => onBuild()}
          disabled={busy}
          className="watch mb-3"
        >
          {building
            ? "Building…"
            : state.build
              ? "Watch how it picked these acts"
              : "Build undercard"}
        </button>
      )}
      <div className="trace-body">
        <div className="trace-head">
          <h2 className="panel-title">Qloo calls</h2>
          {(!folded || refillCalls > 0) && (
            <p className="trace-tally">
              {folded
                ? refillCount
                : `${buildCalls} of ${CALL_CAP}${refillCalls > 0 ? ` · ${refillCount}` : ""}`}
            </p>
          )}
        </div>
        {folded && (
          <div className="trace-pitch">
            <p>
              {savedCalls
                ? `Replays the saved build: ${savedCalls} Qloo calls, then the lineup reprints.`
                : "Replays the saved build call by call, then the lineup reprints."}
            </p>
            {live && !state.refusal && (
              <button
                type="button"
                onClick={() => onBuild({ fresh: true })}
                className="link"
              >
                Run the agent live instead
              </button>
            )}
          </div>
        )}
        {state.status === "idle" && !state.build && (
          <p className="trace-line">
            Every Qloo call the AI agent makes will list here, with its
            parameters and result count.
          </p>
        )}
        {building && (
          <p aria-live="polite" className="trace-line">
            {state.note ?? "Planning the Qloo calls"}
          </p>
        )}
        {state.status === "done" && state.summary && state.build?.replayed && (
          <div className="trace-pitch">
            <p>
              Replayed the build saved{" "}
              {savedAt.format(new Date(state.build.createdAt))} UTC:{" "}
              {state.summary.calls} Qloo calls, served from the cache.
            </p>
            {/* After a refusal, the replay below is the next step, not another fresh build. */}
            {live && !state.refusal && (
              <button
                type="button"
                onClick={() => onBuild({ fresh: true })}
                className="link"
              >
                Run the agent live instead
              </button>
            )}
          </div>
        )}
        {state.status === "done" && state.summary && !state.build?.replayed && (
          <p className="trace-line">
            Built with {state.summary.calls} Qloo calls in{" "}
            {seconds(state.summary.ms)}.
          </p>
        )}
        {refillingName && (
          <p aria-live="polite" className="trace-line">
            Finding a replacement for {refillingName} in the same fee range…
          </p>
        )}
        {state.ordering && (
          <p aria-live="polite" className="trace-line">
            Asking Qloo how much the acts&apos; fans overlap…
          </p>
        )}
        {state.redrafting && (
          <p aria-live="polite" className="trace-line">
            Redrafting every slot you didn&apos;t keep…
          </p>
        )}
        {state.refillError && (
          <p role="alert" className="alert">
            {state.refillError}
          </p>
        )}
        {state.error && (
          <div className="trace-pitch">
            <p role="alert" className="alert">
              {state.error}
            </p>
            {/* A busy Qloo (M6g) or a failed planner call: the saved build still replays, with
                no Qloo or Claude call. */}
            {(state.errorCode === "qloo-busy" ||
              state.errorCode === "planner-failed") &&
            savedCalls ? (
              <button type="button" onClick={() => onBuild()} className="link">
                Watch the saved build instead
              </button>
            ) : null}
          </div>
        )}
        {state.refusal && (
          <div className="trace-pitch">
            <p role="alert" className="alert">
              {state.refusal}
            </p>
            {state.build && replay && (
              <button type="button" onClick={() => onBuild()} className="link">
                Replay the saved build
              </button>
            )}
          </div>
        )}
        {state.calls.length > 0 && (
          <ol ref={listRef} aria-label="Qloo calls" className="trace-list">
            {state.calls.map((call, index) => (
              <CallRow
                key={call.n}
                call={call}
                before={state.notes
                  .filter((note) => note.at === index)
                  .map((note) => note.text)}
                after={
                  index === state.calls.length - 1
                    ? state.notes
                        .filter((note) => note.at > index)
                        .map((note) => note.text)
                    : []
                }
                highlighted={
                  call.n === state.latest &&
                  (building ||
                    (state.refilling !== null && call.tool === "refill") ||
                    (state.redrafting && call.tool === "redraft") ||
                    (state.ordering && call.tool === "running_order"))
                }
              />
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
