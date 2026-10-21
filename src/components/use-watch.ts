"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { BuildState } from "@/lib/build-state";
import type { FeeBandId } from "@/lib/fee-bands";
import type { ClimbEvent } from "@/lib/lift-climb";

/**
 * Watch's pace (the chart's editions): a headliners-only list holds 0.8 s, each venue's
 * re-sort 1.6 s, and the last edition 1.4 s before the lineup reprints. Boise's 8 steps play
 * in about 12.6 s, so the whole replay stays under 20 s with something changing every 1-2 s.
 */
export const BASELINE_HOLD_MS = 800;
export const VENUE_HOLD_MS = 1600;
export const END_HOLD_MS = 1400;

export const holdFor = (step: ClimbEvent) =>
  step.venue ? VENUE_HOLD_MS : BASELINE_HOLD_MS;

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribe(change: () => void) {
  const query = window.matchMedia?.(REDUCED);
  query?.addEventListener?.("change", change);
  return () => query?.removeEventListener?.("change", change);
}
const reducedNow = () => window.matchMedia?.(REDUCED).matches === true;

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, reducedNow, () => false);
}

/**
 * idle: the saved lineup. calls: Watch was pressed and the build's calls stream, before its
 * first ranking. climbing: an edition of the chart is on screen. done: the lineup is back.
 */
export type WatchPhase = "idle" | "calls" | "climbing" | "done";

/**
 * Paces the climb steps a build streams (src/lib/lift-climb.ts) so each edition can be read,
 * with a skip. Under reduced motion the editions step through at the same pace; the screen only
 * stops them moving (no glide between places, no print-in).
 */
export function useWatch(state: BuildState) {
  const reduced = useReducedMotion();
  const [watching, setWatching] = useState(false);
  const [shown, setShown] = useState(0);
  const [finished, setFinished] = useState(false);
  const steps = state.climbs;
  const streaming = state.status === "building";

  const start = useCallback(() => {
    setWatching(true);
    setShown(0);
    setFinished(false);
  }, []);

  const skip = useCallback(() => {
    setShown(Number.MAX_SAFE_INTEGER);
    setFinished(true);
  }, []);

  useEffect(() => {
    if (!watching || finished) return;
    if (shown < steps.length) {
      const hold = shown === 0 ? 0 : holdFor(steps[shown - 1]);
      const next = setTimeout(() => setShown((n) => n + 1), hold);
      return () => clearTimeout(next);
    }
    if (!streaming) {
      const end = setTimeout(
        () => setFinished(true),
        steps.length ? END_HOLD_MS : 0,
      );
      return () => clearTimeout(end);
    }
  }, [watching, finished, streaming, shown, steps]);

  // A build that ends in an error stops the show; the error shows where the lineup was.
  const failed = watching && !streaming && state.status === "error";
  const ended = finished || failed;
  const count = Math.min(steps.length, shown);
  const phase: WatchPhase = !watching
    ? "idle"
    : ended
      ? "done"
      : count === 0
        ? "calls"
        : "climbing";
  const seen = useMemo(() => steps.slice(0, count), [steps, count]);

  /** The latest edition shown for a band, or null before its first. */
  const latest = useCallback(
    (band: FeeBandId): ClimbEvent | null =>
      [...seen].reverse().find((step) => step.band === band) ?? null,
    [seen],
  );

  return {
    phase,
    reduced,
    start,
    skip,
    /** Editions shown so far, in order. */
    seen,
    /** The edition on screen now. */
    current: seen.at(-1) ?? null,
    latest,
    /** How many editions the build has sent, shown or not. */
    total: steps.length,
  };
}
