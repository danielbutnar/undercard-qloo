"use client";

import { useEffect, useRef, useState } from "react";
import type { TraceCall } from "@/lib/build-events";
import type { BuildState } from "@/lib/build-state";

const CALL_CAP = 12;

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

// The newest call shows its parameters as it streams in; the rest fold behind a toggle so the
// trace stays readable at 1440x810.
function CallRow({
  call,
  highlighted,
}: {
  call: TraceCall;
  highlighted: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const showParams = highlighted || expanded;
  const count = call.resultCount ?? "—";
  return (
    <li
      className={`border-l-4 py-2 pl-3 ${highlighted ? "border-accent" : "border-transparent"}`}
    >
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
    </li>
  );
}

/**
 * The job ticket beside the board: the Build button and every Qloo call the agent makes, in
 * blue ink, with its parameters and result count.
 */
export function TracePanel({
  state,
  onBuild,
}: {
  state: BuildState;
  onBuild: () => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const building = state.status === "building";

  // Keep the newest call in view as the trace grows.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [state.calls.length]);

  return (
    <aside
      aria-labelledby="trace-title"
      className="flex flex-col border-2 border-rule bg-surface"
    >
      <div className="border-b-2 border-rule p-4">
        <button
          type="button"
          onClick={onBuild}
          disabled={building}
          className="w-full rounded-sm border-2 border-accent bg-accent px-4 py-2 font-display text-figure font-extrabold uppercase text-on-accent hover:border-ink hover:bg-ink disabled:cursor-wait disabled:border-muted disabled:bg-surface disabled:text-muted"
        >
          {building ? "Building…" : "Build undercard"}
        </button>
      </div>
      <div className="flex min-h-0 flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="trace-title"
            className="font-display text-name font-extrabold uppercase"
          >
            Qloo calls
          </h2>
          <p className="text-label text-muted">
            {state.calls.length} of {CALL_CAP}
          </p>
        </div>
        {state.status === "idle" && (
          <p className="text-label text-muted">
            Every Qloo call the agent makes will list here, with its parameters
            and result count.
          </p>
        )}
        {building && (
          <p aria-live="polite" className="text-label">
            {state.note ?? "Planning the Qloo calls"}
          </p>
        )}
        {state.status === "done" && state.summary && (
          <p className="text-label">
            Built with {state.summary.calls} Qloo calls in{" "}
            {seconds(state.summary.ms)}.
          </p>
        )}
        {state.error && (
          <p role="alert" className="text-label font-semibold text-danger">
            {state.error}
          </p>
        )}
        {state.calls.length > 0 && (
          <ol
            ref={listRef}
            aria-label="Qloo calls"
            className="flex max-h-[28rem] min-h-48 flex-col divide-y divide-muted/40 overflow-y-auto lg:max-h-[calc(100dvh-30rem)]"
          >
            {state.calls.map((call) => (
              <CallRow
                key={call.n}
                call={call}
                highlighted={building && call.n === state.latest}
              />
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
