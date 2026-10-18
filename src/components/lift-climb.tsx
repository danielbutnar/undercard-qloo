"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FeeBand, FeeBandId } from "@/lib/fee-bands";
import { playClimbs, type ClimbEvent } from "@/lib/lift-climb";

const PLAIN_BAND: Record<FeeBandId, string> = {
  mid: "Mid-size acts",
  opener: "Opening acts",
};
const END_HOLD_MS = 1600;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** One band's list as it stands, each act a row; rows glide to their new places (FLIP). */
function BandList({
  band,
  step,
  animate,
  showFrom = false,
}: {
  band: FeeBandId;
  step: ClimbEvent | null;
  animate: boolean;
  showFrom?: boolean;
}) {
  const rows = useRef(new Map<string, HTMLLIElement>());
  const last = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    for (const [id, row] of rows.current) {
      const box = row.getBoundingClientRect();
      next.set(id, box);
      if (!animate || typeof row.animate !== "function") continue;
      const before = last.current.get(id);
      // A row that moved glides from its old place; a row that's new rises in from below.
      const keyframes: Keyframe[] = before
        ? [
            { transform: `translateY(${before.top - box.top}px)` },
            { transform: "translateY(0)" },
          ]
        : [
            { transform: "translateY(24px)", opacity: 0 },
            { transform: "translateY(0)", opacity: 1 },
          ];
      if (!before || before.top !== box.top)
        row.animate(keyframes, {
          duration: 650,
          easing: "cubic-bezier(.2,.7,.2,1)",
        });
    }
    last.current = next;
  }, [step, animate]);

  return (
    <section
      aria-label={PLAIN_BAND[band]}
      className="flex min-w-0 flex-col gap-1"
    >
      <h3 className="text-body font-bold">{PLAIN_BAND[band]}</h3>
      <p className="text-label text-muted" aria-live="polite">
        {step?.venue
          ? `Re-ranked with the fans of ${step.venue.name} added`
          : "Ranked for the headliners' fans alone"}
      </p>
      <ol className="flex flex-col">
        {(step?.acts ?? []).map((act) => (
          <li
            key={act.entityId}
            ref={(node) => {
              if (node) rows.current.set(act.entityId, node);
              else rows.current.delete(act.entityId);
            }}
            className="flex items-baseline justify-between gap-3 border-b border-rule/40 py-1"
          >
            <span
              className={`text-body ${act.move !== null ? "font-bold" : ""}`}
            >
              {act.name}
            </span>
            {act.move !== null && step?.venue && (
              <span className="shrink-0 rounded-sm border border-accent px-1 text-label font-semibold text-accent">
                +{act.move}, {step.venue.name}
                {showFrom &&
                  ` (was ${(step.acts.indexOf(act) + 1 + act.move).toString()}${["th", "st", "nd", "rd"][(step.acts.indexOf(act) + 1 + act.move) % 10 < 4 && Math.floor(((step.acts.indexOf(act) + 1 + act.move) % 100) / 10) !== 1 ? (step.acts.indexOf(act) + 1 + act.move) % 10 : 0]})`}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The lift, visible (M9a): each band's list for the headliners alone, then re-sorted as each
 * venue's Qloo result comes in, the acts that venue lifts climbing with their real move. A
 * replay plays the steps at a pace a viewer can follow, with a skip; under reduced motion the
 * end state shows at once. Every step is one Qloo call's result.
 */
export function LiftClimb({
  steps,
  bands,
  live,
  onDone,
  stepper = false,
  progress = false,
  showFrom = false,
}: {
  steps: readonly ClimbEvent[];
  bands: readonly FeeBand[];
  /** The build is still streaming, so more steps may come. */
  live: boolean;
  onDone: () => void;
  /** M9d's stepper candidate: one list at a time, with the step it's on. */
  stepper?: boolean;
  /** M9d candidates: the venue step it's on, and where a lifted act came from. */
  progress?: boolean;
  showFrom?: boolean;
}) {
  const [still] = useState(reducedMotion);
  const [shown, setShown] = useState(() =>
    still ? steps.length : Math.min(1, steps.length),
  );
  const caughtUp = still ? steps.length : shown;
  // The latest onDone, so a re-render doesn't restart the timers.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (still) {
      if (live) return;
      const end = setTimeout(() => done.current(), END_HOLD_MS * 2);
      return () => clearTimeout(end);
    }
    if (shown < steps.length) {
      const hold = shown === 0 ? 0 : playClimbs(steps)[shown - 1].holdMs;
      const next = setTimeout(() => setShown((n) => n + 1), hold);
      return () => clearTimeout(next);
    }
    if (!live && steps.length > 0) {
      const end = setTimeout(() => done.current(), END_HOLD_MS);
      return () => clearTimeout(end);
    }
  }, [shown, steps, live, still]);

  const latest = (band: FeeBandId) =>
    [...steps.slice(0, caughtUp)]
      .reverse()
      .find((step) => step.band === band) ?? null;

  return (
    <div className="mt-3 flex w-full flex-col gap-3 border-t-2 border-rule pt-3 text-left">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-body font-bold">
          How the town&apos;s venue crowds move acts up Qloo&apos;s list
        </h2>
        <button
          type="button"
          onClick={() => {
            setShown(steps.length);
            done.current();
          }}
          className="text-label text-ink underline underline-offset-2 hover:text-accent"
        >
          Skip to the lineup
        </button>
      </div>
      {progress && (
        <p className="text-label font-semibold" aria-live="polite">
          {(() => {
            const venues = [
              ...new Set(steps.flatMap((s) => (s.venue ? [s.venue.name] : []))),
            ];
            const now = steps[Math.max(caughtUp, 1) - 1]?.venue?.name;
            return now
              ? `Venue ${venues.indexOf(now) + 1} of ${venues.length}: ${now}`
              : "The headliners' fans alone";
          })()}
        </p>
      )}
      {stepper ? (
        <div className="flex flex-col gap-1">
          <p className="text-label font-semibold" aria-live="polite">
            Step {Math.max(caughtUp, 1)} of {steps.length}
          </p>
          {(() => {
            const step = steps[Math.max(caughtUp, 1) - 1] ?? null;
            return step ? (
              <BandList band={step.band} step={step} animate={!still} />
            ) : null;
          })()}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[...bands]
            .sort((a, b) => b.minPopularity - a.minPopularity)
            .map((band) => (
              <BandList
                key={band.id}
                band={band.id}
                step={latest(band.id)}
                animate={!still}
                showFrom={showFrom}
              />
            ))}
        </div>
      )}
    </div>
  );
}
