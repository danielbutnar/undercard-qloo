"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { setlistCue, type SetlistLine } from "./setlist-words";
import { signName } from "./town-scene";
import { useReveal } from "./use-reveal";

const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** One numbered line as a screen reader hears it: the call, its venue, its count. */
function lineLabel(line: SetlistLine, margin: string | null): string {
  const venue = line.venue ? ` ${signName(line.venue.name)} ${line.after}` : "";
  const count = line.noFanData ? "no fan data" : line.count;
  return `Call ${line.n}: ${line.text}${venue}${count ? `, ${count}` : ""}${margin ? `; ${margin}` : ""}`;
}

/**
 * The AI agent's setlist (WS12 item 1), under the town where the Qloo calls panel stood: the
 * build's Qloo calls as numbered lines on a taped white sheet, in the headline type. A venue's
 * line sets the venue in its poster colour, grey where Qloo had no fan data; the agent's own
 * lines sit between the calls where it said them; the call that lifted the act the door check
 * shows is ringed, with that act's move beside it. "Play it live" runs the agent fresh. The full
 * calls list, with each call's parameters, follows the sheet (`children`).
 */
export function Setlist({
  festival,
  createdAt,
  lines,
  closing,
  hues,
  circled,
  margin,
  onLive,
  children,
}: {
  festival: { name: string; city: string };
  /** When the build on the sheet was made; left out while a run is under way. */
  createdAt?: string;
  lines: readonly SetlistLine[];
  closing: readonly string[];
  hues: ReadonlyMap<string, number>;
  /** The call to ring: the one that lifted the act the door check shows. */
  circled: number | null;
  /** That act's move, written beside the ring. */
  margin: string | null;
  /** Runs the agent fresh; left out where a live run isn't on offer. */
  onLive?: () => void;
  children?: ReactNode;
}) {
  const reveal = useReveal<HTMLElement>();
  return (
    <section ref={reveal} aria-labelledby="setlist-title" className="setlist">
      <div className="setlist-sheet">
        <span className="setlist-tape setlist-tape-left" aria-hidden />
        <span className="setlist-tape setlist-tape-right" aria-hidden />
        <div className="setlist-head">
          <p className="setlist-where">
            {festival.name} · {festival.city}
            {createdAt ? ` · ${day.format(new Date(createdAt))}` : ""}
          </p>
          <h2 id="setlist-title" className="setlist-title">
            The AI agent&apos;s setlist
          </h2>
          <p className="setlist-count">
            {lines.length} Qloo {lines.length === 1 ? "call" : "calls"}
          </p>
        </div>
        <ol aria-label="The calls, in order" className="setlist-lines">
          {lines.map((line, index) => {
            const ring = line.n === circled;
            const hue = line.venue
              ? (hues.get(line.venue.entityId) ?? null)
              : null;
            return (
              <li
                key={line.n}
                aria-label={lineLabel(line, ring ? margin : null)}
                className={`setlist-item ${ring ? "is-circled" : ""}`}
                style={{ "--i": index } as CSSProperties}
              >
                {line.before.map((text) => (
                  <p key={text} className="setlist-agent">
                    {setlistCue(text)}
                  </p>
                ))}
                <div className="setlist-line">
                  <span className="setlist-n">{line.n}</span>
                  <span className="setlist-text">
                    {line.text}
                    {line.venue && (
                      <>
                        {" "}
                        <span
                          className={`setlist-venue ${hue !== null && !line.noFanData ? `venue-${hue}` : "is-grey"}`}
                        >
                          {signName(line.venue.name)}
                        </span>{" "}
                        {line.after}
                      </>
                    )}
                  </span>
                  <span className="setlist-tally">
                    {line.noFanData ? "no fan data" : line.count}
                  </span>
                </div>
                {ring && margin && (
                  <p className="setlist-margin">
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
          <p key={text} className="setlist-agent setlist-closing">
            {setlistCue(text)}
          </p>
        ))}
        {onLive && (
          <div className="setlist-foot">
            <button type="button" onClick={onLive} className="setlist-live">
              <span className="setlist-rec" aria-hidden />
              Play it live
            </button>
            <p className="setlist-live-sub">
              Runs the AI agent fresh, call by call
            </p>
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

/** The landing's last word (WS12 item 1): who decides, then one way on. */
export function PageEnd() {
  const reveal = useReveal<HTMLElement>();
  return (
    <section ref={reveal} aria-label="Who decides" className="page-end">
      <p className="page-end-line">
        Undercard drafts.
        <br /> The buyer makes every call.
      </p>
      <Link href="/your-festival" className="page-end-link">
        Draft your own festival
        <svg viewBox="0 0 16 16" aria-hidden>
          <path d="M2 8 H13 M9 4 L13 8 L9 12" />
        </svg>
      </Link>
    </section>
  );
}
