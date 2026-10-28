"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { buildReducer, IDLE_BUILD, type BuildState } from "@/lib/build-state";
import type { Act } from "@/lib/lineup";
import type { UnavailableReason } from "@/lib/unavailable";
import type { YourBrief } from "@/lib/your-festival";
import { streamEvents } from "./stream-events";
import type { BuildRequest } from "./trace-panel";

/**
 * Runs a build on POST /api/undercard and refills on POST /api/refill, folding both streams
 * of events into one board state. Every request names its festival id.
 */
export function useUndercardBuild(
  initial: BuildState = IDLE_BUILD,
  festivalId?: string,
  /** A judge's own brief (M6f): sent with every build, which then runs live and isn't saved. */
  brief?: YourBrief,
  /** A checked town (M6m): a build that isn't fresh only replays, never runs the agent. */
  replayOnly = false,
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
          {
            fresh: request.fresh ?? false,
            festival: festivalId,
            ...(brief ? { brief } : {}),
            ...(replayOnly && !request.fresh ? { replayOnly: true } : {}),
          },
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
    [festivalId, brief, replayOnly],
  );

  // WS13.5: the buyer adds the AI's local pick to the bill, or takes it off; no request.
  const toggleLocal = useCallback(
    (entityId: string) => dispatch({ type: "toggleLocal", entityId }),
    [],
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

  const toggleKeep = useCallback(
    (act: Act) => dispatch({ type: "toggleKeep", entityId: act.entityId }),
    [],
  );

  // M8c: every slot not kept is refilled from the build's rooms, at most 3 Qloo calls.
  const redraft = useCallback(async () => {
    const current = stateRef.current;
    if (!current.build || current.refilling || current.redrafting) return;
    const replace = current.acts
      .filter((act) => !current.keeping.includes(act.entityId))
      .map((act) => ({ entityId: act.entityId, band: act.band }));
    if (current.keeping.length === 0 || replace.length === 0) return;
    const controller = new AbortController();
    refillController.current = controller;
    dispatch({ type: "startRedraft" });
    try {
      await streamEvents(
        "/api/redraft",
        {
          festival: festivalId,
          buildId: current.build.id,
          replace,
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
      if (!controller.signal.aborted)
        dispatch({
          type: "refillFail",
          message: "Couldn't reach the redraft service. Try again.",
        });
    }
  }, [festivalId]);

  // M8a: the running order for the acts on the bill, scored in at most 10 Qloo calls.
  const runningOrder = useCallback(async () => {
    const current = stateRef.current;
    if (
      !current.build ||
      current.refilling ||
      current.redrafting ||
      current.ordering
    )
      return;
    const acts = current.acts
      .filter((act) => !current.unavailable.includes(act.entityId))
      .map(({ entityId, name, band, popularity }) => ({
        entityId,
        name,
        band,
        popularity,
      }));
    const controller = new AbortController();
    refillController.current = controller;
    dispatch({ type: "startOrder" });
    try {
      await streamEvents(
        "/api/running-order",
        { festival: festivalId, buildId: current.build.id, acts },
        controller.signal,
        (event) => dispatch({ type: "refillEvent", event }),
      );
      dispatch({ type: "refillEnd" });
    } catch {
      if (!controller.signal.aborted)
        dispatch({
          type: "refillFail",
          message: "Couldn't reach the running-order service. Try again.",
        });
    }
  }, [festivalId]);

  const closeOrder = useCallback(() => dispatch({ type: "closeOrder" }), []);

  return {
    state,
    build,
    markUnavailable,
    toggleKeep,
    redraft,
    runningOrder,
    closeOrder,
    toggleLocal,
  };
}
