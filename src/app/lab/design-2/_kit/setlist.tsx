"use client";

import type { CSSProperties } from "react";
import { signName } from "@/components/chart/town-scene";
import { agentLine } from "@/components/chart/words";
import { CallRow } from "@/components/trace-panel";
import type { TraceCall } from "@/lib/build-events";
import { useReveal } from "./use-reveal";
import type { SetlistLine } from "./words";

const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** A marker loop drawn round a line, overshooting where it closes. */
function Circle() {
  return (
    <svg
      className="d2-circle"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M12 31 C3 25 1 11 19 6 C40 1 76 2 91 6 C100 9 100 30 88 34 C70 39 30 39 12 35 C3 33 0 21 8 12 C11 8 18 5 27 4"
      />
    </svg>
  );
}

/**
 * The AI agent's setlist (WS12 item 1): the saved build's Qloo calls as numbered lines on a
 * taped white sheet, in the headline type. A venue's line sets the venue in its poster colour
 * (grey where Qloo had no fan data); the call that lifted the act the page follows is circled,
 * with that act's move in the margin. "Play it live" runs the agent fresh; the full calls list,
 * with each call's parameters, folds under the sheet.
 */
export function Setlist({
  festival,
  createdAt,
  lines,
  closing,
  hues,
  circled,
  margin,
  trace,
}: {
  festival: { name: string; city: string };
  createdAt: string;
  lines: readonly SetlistLine[];
  closing: readonly string[];
  hues: Readonly<Record<string, number | null>>;
  /** The call to circle: the one that lifted the act the page follows. */
  circled: number | null;
  /** That act's move, written beside the circle. */
  margin: string | null;
  trace: readonly TraceCall[];
}) {
  const reveal = useReveal<HTMLElement>();
  return (
    <section
      ref={reveal}
      aria-labelledby="d2-setlist-title"
      className="d2-setlist"
    >
      <div className="d2-sheet">
        <span className="d2-tape d2-tape-left" aria-hidden />
        <span className="d2-tape d2-tape-right" aria-hidden />
        <div className="d2-sheet-head">
          <p className="d2-sheet-where">
            {festival.name} · {festival.city} ·{" "}
            {day.format(new Date(createdAt))}
          </p>
          <h2 id="d2-setlist-title" className="d2-sheet-title">
            The AI agent&apos;s setlist
          </h2>
          <p className="d2-sheet-count">{lines.length} Qloo calls</p>
        </div>
        <ol className="d2-set">
          {lines.map((line, index) => {
            const hue = line.venue ? (hues[line.venue.entityId] ?? null) : null;
            const isCircled = line.n === circled;
            return (
              <li
                key={line.n}
                className={`d2-set-item ${isCircled ? "is-circled" : ""}`}
                style={{ "--i": index } as CSSProperties}
              >
                {line.before.map((text) => (
                  <p key={text} className="d2-set-agent">
                    {agentLine(text)}
                  </p>
                ))}
                <div className="d2-set-line">
                  <span className="d2-set-n" aria-hidden>
                    {line.n}
                  </span>
                  <span className="d2-set-text">
                    <span className="sr-only">Call {line.n}: </span>
                    {line.text}
                    {line.venue && (
                      <>
                        {" "}
                        <span
                          className={`d2-set-venue ${hue !== null && !line.noFanData ? `venue-${hue}` : "is-grey"}`}
                        >
                          {signName(line.venue.name)}
                        </span>{" "}
                        {line.after}
                      </>
                    )}
                  </span>
                  <span className="d2-set-count">
                    {line.noFanData ? "no fan data" : line.count}
                  </span>
                  {isCircled && <Circle />}
                </div>
                {isCircled && margin && (
                  <p className="d2-set-margin">
                    <svg viewBox="0 0 24 24" aria-hidden>
                      <path d="M5 19 C 9 9, 14 6, 19 5 M13 4 L19 5 L17 11" />
                    </svg>
                    {margin}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        {closing.map((text) => (
          <p key={text} className="d2-set-agent d2-set-closing">
            {agentLine(text)}
          </p>
        ))}
        <div className="d2-sheet-foot">
          {/* Step 0 is a picture of the direction: the button runs nothing from the lab. */}
          <button type="button" className="d2-live">
            <span className="d2-rec" aria-hidden />
            Play it live
          </button>
          <p className="d2-live-sub">Runs the AI agent fresh, call by call</p>
        </div>
      </div>
      <details className="d2-set-all">
        <summary>Every call, with its parameters</summary>
        <ol className="trace-list">
          {trace.map((call) => (
            <CallRow key={call.n} call={call} highlighted={false} />
          ))}
        </ol>
      </details>
    </section>
  );
}
