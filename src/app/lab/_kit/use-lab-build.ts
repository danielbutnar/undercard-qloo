"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useUndercardBuild } from "@/components/use-undercard-build";
import { firstBoard } from "@/lib/build-state";
import type { FeeBandId } from "@/lib/fee-bands";
import type { FirstBill } from "@/lib/first-bill";
import { playClimbs, type ClimbEvent } from "@/lib/lift-climb";

/** idle: the saved bill. building: the replay streams. climbing: a venue's re-sort is on screen. */
export type LabPhase = "idle" | "building" | "climbing" | "done";

/** How long the last venue's re-sort stays up before the bill reprints (as the live climb). */
const END_HOLD_MS = 1600;

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribe(change: () => void) {
  const query = window.matchMedia?.(REDUCED);
  query?.addEventListener("change", change);
  return () => query?.removeEventListener("change", change);
}
const reducedNow = () => window.matchMedia?.(REDUCED).matches === true;

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, reducedNow, () => false);
}

/**
 * The real replay behind every lab direction. Watch streams the saved build again from
 * POST /api/undercard (no Qloo or Claude call, never rate-limited), and the climb's steps are
 * paced as the live app paces them (src/lib/lift-climb.ts playClimbs: 0.9 s for a headliners-only
 * list, 1.8 s per venue). Under reduced motion the end state shows once the replay is in.
 */
export function useLabBuild(first: FirstBill | null, festivalId: string) {
  const { state, build } = useUndercardBuild(firstBoard(first), festivalId);
  const reduced = useReducedMotion();
  const [watching, setWatching] = useState(false);
  const [shown, setShown] = useState(0);
  const [finished, setFinished] = useState(false);
  const steps = state.climbs;
  const streaming = state.status === "building";

  const watch = useCallback(() => {
    setWatching(true);
    setShown(0);
    setFinished(false);
    void build();
  }, [build]);

  const skip = useCallback(() => {
    setShown(steps.length);
    setFinished(true);
  }, [steps.length]);

  useEffect(() => {
    // Under reduced motion nothing is paced: the end state shows once the replay is in.
    if (!watching || finished || reduced) return;
    if (shown < steps.length) {
      const hold = shown === 0 ? 0 : playClimbs(steps)[shown - 1].holdMs;
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
  }, [watching, finished, reduced, streaming, shown, steps]);

  const ended = finished || (reduced && watching && !streaming);
  const count = reduced ? (ended ? steps.length : 0) : shown;
  const phase: LabPhase = !watching
    ? "idle"
    : ended
      ? "done"
      : count === 0
        ? "building"
        : "climbing";
  const seen = steps.slice(0, count);
  /** The latest step shown for a band, or null before its first. */
  const latest = (band: FeeBandId): ClimbEvent | null =>
    [...seen].reverse().find((step) => step.band === band) ?? null;

  return {
    state,
    phase,
    watch,
    skip,
    reduced,
    /** Climb steps shown so far, in order. */
    seen,
    /** The step on screen now. */
    current: seen.at(-1) ?? null,
    latest,
    /** Every step the replay has sent, shown or not. */
    steps,
  };
}
