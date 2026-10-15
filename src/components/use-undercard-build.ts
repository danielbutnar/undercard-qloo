"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { buildReducer, IDLE_BUILD } from "@/lib/build-state";
import type { Act } from "@/lib/lineup";
import { streamEvents } from "./stream-events";
import type { BuildRequest } from "./trace-panel";

/**
 * Runs a build on POST /api/undercard and refills on POST /api/refill, folding both streams
 * of events into one board state.
 */
export function useUndercardBuild() {
  const [state, dispatch] = useReducer(buildReducer, IDLE_BUILD);
  const stateRef = useRef(state);
  const buildController = useRef<AbortController | null>(null);
  const refillController = useRef<AbortController | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(
    () => () => {
      buildController.current?.abort();
      refillController.current?.abort();
    },
    [],
  );

  const build = useCallback(async (request: BuildRequest = {}) => {
    buildController.current?.abort();
    refillController.current?.abort();
    const controller = new AbortController();
    buildController.current = controller;
    dispatch({ type: "start" });
    try {
      await streamEvents(
        "/api/undercard",
        { fresh: request.fresh ?? false },
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
  }, []);

  const markUnavailable = useCallback(async (act: Act) => {
    const current = stateRef.current;
    if (!current.build || current.refilling) return;
    const controller = new AbortController();
    refillController.current = controller;
    dispatch({ type: "markUnavailable", entityId: act.entityId });
    try {
      await streamEvents(
        "/api/refill",
        {
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
  }, []);

  return { state, build, markUnavailable };
}
