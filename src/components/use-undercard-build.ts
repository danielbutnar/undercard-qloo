"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";
import type { Act } from "@/lib/lineup";
import type { UnavailableReason } from "@/lib/unavailable";
import { streamEvents } from "./stream-events";
import type { BuildRequest } from "./trace-panel";

/**
 * Runs a build on POST /api/undercard and refills on POST /api/refill, folding both streams
 * of events into one board state.
 */
/** Builds, replays and refills for one festival; every request names its festival id. */
export function useUndercardBuild(
  initial: BuildState = IDLE_BUILD,
  festivalId?: string,
) {
  const [state, dispatch] = useReducer(buildReducer, initial);
  const stateRef = useRef(state);
  const buildController = useRef<AbortController | null>(null);
  const refillController = useRef<AbortController | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // No abort on cleanup: Next.js can clean up effects without unmounting the screen (a hidden
  // Activity, a Fast Refresh), and an aborted replay would leave the board building forever.
  // A new build still cancels the one before it.

  const build = useCallback(
    async (request: BuildRequest = {}) => {
      buildController.current?.abort();
      refillController.current?.abort();
      const controller = new AbortController();
      buildController.current = controller;
      dispatch({ type: "start", fresh: request.fresh ?? false });
      try {
        await streamEvents(
          "/api/undercard",
          { fresh: request.fresh ?? false, festival: festivalId },
          controller.signal,
          (event) => dispatch({ type: "event", event }),
        );
        dispatch({ type: "end" });
      } catch {
        if (!controller.signal.aborted) {
          dispatch({
            type: "fail",
            message: "Couldn't reach the build service. Try again.",
          });
        }
      }
    },
    [festivalId],
  );

  const markUnavailable = useCallback(
    async (act: Act, reason?: UnavailableReason) => {
      const current = stateRef.current;
      if (!current.build || current.refilling) return;
      const controller = new AbortController();
      refillController.current = controller;
      dispatch({ type: "markUnavailable", entityId: act.entityId, reason });
      try {
        await streamEvents(
          "/api/refill",
          {
            festival: festivalId,
            buildId: current.build.id,
            unavailableId: act.entityId,
            band: act.band,
            anchorVenueId: act.anchorVenue.entityId,
            excludeIds: [
              ...new Set([
                ...current.acts.map((onBoard) => onBoard.entityId),
                ...current.unavailable,
              ]),
            ],
            ...(reason ? { reason } : {}),
          },
          controller.signal,
          (event) => dispatch({ type: "refillEvent", event }),
        );
        dispatch({ type: "refillEnd" });
      } catch {
        if (!controller.signal.aborted) {
          dispatch({
            type: "refillFail",
            message: "Couldn't reach the refill service. Try again.",
          });
        }
      }
    },
    [festivalId],
  );

  return { state, build, markUnavailable };
}
