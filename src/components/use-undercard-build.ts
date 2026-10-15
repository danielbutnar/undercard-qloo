"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { BuildEventSchema } from "@/lib/build-events";
import { buildReducer, IDLE_BUILD, takeLines } from "@/lib/build-state";

/** Runs a build on POST /api/undercard and folds its streamed events into state. */
export function useUndercardBuild() {
  const [state, dispatch] = useReducer(buildReducer, IDLE_BUILD);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const build = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: "start" });

    try {
      const response = await fetch("/api/undercard", {
        method: "POST",
        signal: controller.signal,
      });
      if (!response.ok || !response.body)
        throw new Error(`HTTP ${response.status}`);
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const { lines, rest } = takeLines(buffer + value);
        buffer = rest;
        for (const line of lines) {
          try {
            const parsed = BuildEventSchema.safeParse(JSON.parse(line));
            if (parsed.success) dispatch({ type: "event", event: parsed.data });
          } catch {
            // A malformed line is skipped; the rest of the stream still counts.
          }
        }
      }
      dispatch({ type: "end" });
    } catch {
      if (!controller.signal.aborted)
        dispatch({
          type: "fail",
          message: "Couldn't reach the build service. Try again.",
        });
    }
  }, []);

  return { state, build };
}
