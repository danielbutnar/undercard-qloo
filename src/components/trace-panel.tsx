"use client";

import { useEffect, useRef, useState } from "react";
import type { TraceCall } from "@/lib/build-events";
import type { BuildState } from "@/lib/build-state";

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

/** The blue Build / Watch button, shared with the bill's phone copy. */
export const WATCH_BUTTON =
  "w-full rounded-sm border-2 border-accent bg-accent px-2 py-2 text-body font-bold text-on-accent hover:border-ink hover:bg-ink disabled:cursor-wait disabled:border-muted disabled:bg-surface disabled:text-muted";

// The newest call shows its parameters as it streams in; the rest fold behind a toggle so the
// trace stays readable at 1440x810.
/** One of the planner's lines, printed in the trace where it was said. */
function PlannerLine({ text }: { text: string }) {
  return (
    <p className="text-label">
      <span className="font-semibold">Agent: </span>
      {text}
    </p>
  );
}

function CallRow({
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
    <li
      className={`border-l-4 py-2 pl-3 ${highlighted ? "border-accent" : "border-transparent"}`}
    >
      {before.length > 0 && (
        <div className="mb-1 flex flex-col gap-1">
          {before.map((text, index) => (
            <PlannerLine key={index} text={text} />
          ))}
        </div>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-label font-semibold wrap-anywhere">
          {call.n}. {call.summary}
        </p>
        <p
          aria-label={`${count} results`}
          className="shrink-0 text-figure font-semibold tabular-nums text-accent"
        >
          {count}
        </p>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <p className="text-label text-muted">
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
            className="text-label text-ink underline underline-offset-2 hover:text-accent"
          >
            Parameters
          </button>
        )}
      </div>
      {showParams && (
        <ul className="mt-1 flex flex-col">
          {call.params.map((param) => (
            <li key={param.key} className="text-label wrap-anywhere">
              <code className="font-body">
                {param.key}={param.value}
              </code>
            </li>
          ))}
        </ul>
      )}
      {call.error && <p className="text-label text-danger">{call.error}</p>}
      {after.length > 0 && (
        <div className="mt-1 flex flex-col gap-1">
          {after.map((text, index) => (
            <PlannerLine key={index} text={text} />
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * The job ticket beside the board: the Build button and every Qloo call the agent makes, in
 * blue ink, with its parameters and result count.
 */
export function TracePanel({
  state,
  savedCalls,
  onBuild,
  buttonOnPhones = true,
}: {
  state: BuildState;
  /** Qloo calls in the saved build the first screen shows, for the replay's description. */
  savedCalls?: number;
  onBuild: (request?: BuildRequest) => void;
  /** False when the bill carries its own copy of the button for phones (FestivalScreen). */
  buttonOnPhones?: boolean;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const building = state.status === "building";
  // The first screen shows a saved build; its trace stays folded until it is replayed.
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
  const refillCount = `${refillCalls} refill ${refillCalls === 1 ? "call" : "calls"}`;
  const refillingName = state.acts.find(
    (act) => act.entityId === state.refilling,
  )?.name;

  // Keep the newest call in view as the trace grows.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [state.calls.length]);

  return (
    <aside
      aria-label="Qloo calls"
      className="flex flex-col border-2 border-rule bg-surface"
    >
      <div
        className={`border-b-2 border-rule p-3 ${buttonOnPhones ? "" : "hidden lg:block"}`}
      >
        <button
          type="button"
          onClick={() => onBuild()}
          disabled={busy}
          className={WATCH_BUTTON}
        >
          {building
            ? "Building…"
            : state.build
              ? "Watch how it picked these acts"
              : "Build undercard"}
        </button>
      </div>
      <div className="flex min-h-0 flex-col gap-2 p-4">
        {folded && (
          <div className="flex flex-col items-start gap-1">
            <p className="text-label">
              {savedCalls
                ? `Replays the saved build: ${savedCalls} Qloo calls, then the lineup reprints.`
                : "Replays the saved build call by call, then the lineup reprints."}
            </p>
            {!state.refusal && (
              <button
                type="button"
                onClick={() => onBuild({ fresh: true })}
                className="text-label text-ink underline underline-offset-2 hover:text-accent"
              >
                Run the agent live instead
              </button>
            )}
          </div>
        )}
        {(!folded || refillCalls > 0) && (
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-body font-bold">Qloo calls</h2>
            <p className="text-label text-muted">
              {folded
                ? refillCount
                : `${buildCalls} of ${CALL_CAP}${refillCalls > 0 ? ` · ${refillCount}` : ""}`}
            </p>
          </div>
        )}
        {state.status === "idle" && !state.build && (
          <p className="text-label text-muted">
            Every Qloo call the AI agent makes will list here, with its
            parameters and result count.
          </p>
        )}
        {building && (
          <p aria-live="polite" className="text-label">
            {state.note ?? "Planning the Qloo calls"}
          </p>
        )}
        {state.status === "done" && state.summary && state.build?.replayed && (
          <div className="flex flex-col items-start gap-1">
            <p className="text-label">
              Replayed the build saved{" "}
              {savedAt.format(new Date(state.build.createdAt))} UTC:{" "}
              {state.summary.calls} Qloo calls, served from the cache.
            </p>
            {/* After a refusal, the replay below is the next step, not another fresh build. */}
            {!state.refusal && (
              <button
                type="button"
                onClick={() => onBuild({ fresh: true })}
                className="text-label text-ink underline underline-offset-2 hover:text-accent"
              >
                Run the agent live instead
              </button>
            )}
          </div>
        )}
        {state.status === "done" && state.summary && !state.build?.replayed && (
          <p className="text-label">
            Built with {state.summary.calls} Qloo calls in{" "}
            {seconds(state.summary.ms)}.
          </p>
        )}
        {refillingName && (
          <p aria-live="polite" className="text-label">
            Finding a replacement for {refillingName} in the same fee range…
          </p>
        )}
        {state.ordering && (
          <p aria-live="polite" className="text-label">
            Asking Qloo how much the acts&apos; fans overlap…
          </p>
        )}
        {state.redrafting && (
          <p aria-live="polite" className="text-label">
            Redrafting every slot you didn&apos;t keep…
          </p>
        )}
        {state.refillError && (
          <p role="alert" className="text-label font-semibold text-danger">
            {state.refillError}
          </p>
        )}
        {state.error && (
          <div className="flex flex-col items-start gap-1">
            <p role="alert" className="text-label font-semibold text-danger">
              {state.error}
            </p>
            {/* A busy Qloo (M6g): the saved build still replays, with no Qloo call. */}
            {state.errorCode === "qloo-busy" && savedCalls ? (
              <button
                type="button"
                onClick={() => onBuild()}
                className="text-label text-ink underline underline-offset-2 hover:text-accent"
              >
                Watch the saved build instead
              </button>
            ) : null}
          </div>
        )}
        {state.refusal && (
          <div className="flex flex-col items-start gap-1">
            <p role="alert" className="text-label font-semibold text-danger">
              {state.refusal}
            </p>
            {state.build && (
              <button
                type="button"
                onClick={() => onBuild()}
                className="text-label text-ink underline underline-offset-2 hover:text-accent"
              >
                Replay the saved build
              </button>
            )}
          </div>
        )}
        {state.calls.length > 0 && (
          <ol
            ref={listRef}
            aria-label="Qloo calls"
            className="flex max-h-[28rem] min-h-48 flex-col divide-y divide-muted/40 overflow-y-auto lg:max-h-[calc(100dvh-33rem)]"
          >
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
