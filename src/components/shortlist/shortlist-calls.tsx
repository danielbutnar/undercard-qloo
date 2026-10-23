"use client";

import { CallRow } from "@/components/trace-panel";
import type { Shortlist } from "@/lib/shortlist";
import { callsLine } from "./words";

/**
 * A check's Qloo calls, listed as the trace lists a build's (src/components/trace-panel.tsx):
 * each call with its parameters and result count, a cached one marked, and the calls made
 * counted against the check's cap.
 */
export function ShortlistCalls({
  shortlist,
}: {
  shortlist: Pick<Shortlist, "calls" | "made" | "cap">;
}) {
  return (
    <aside aria-label="Qloo calls" className="panel trace shortlist-calls">
      <div className="trace-body">
        <div className="trace-head">
          <h2 className="panel-title">Qloo calls</h2>
          <p className="trace-tally">
            {shortlist.made} of {shortlist.cap}
          </p>
        </div>
        <p className="trace-line">{callsLine(shortlist)}</p>
        {shortlist.calls.length > 0 && (
          <ol aria-label="Qloo calls" className="trace-list">
            {shortlist.calls.map((call) => (
              <CallRow key={call.n} call={call} highlighted={false} />
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
