"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { buildReducer, IDLE_BUILD } from "@/lib/build-state";
import { streamEvents } from "./stream-events";
import type { BuildRequest } from "./trace-panel";

/** Runs a build on POST /api/undercard and folds its streamed events into state. */
export function useUndercardBuild() {
  const [state, dispatch] = useReducer(buildReducer, IDLE_BUILD);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const build = useCallback(async (request: BuildRequest = {}) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
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

  return { state, dispatch, build };
}
