"use client";

import { createContext, useContext } from "react";

/**
 * The live run (WS13.8), callable from anywhere under the festival screen: "Run it live" under
 * Watch calls it, and so can WS12's setlist ("Play it live") where Watch's button is hidden. It
 * starts a fresh, rate-limited run of the agent on the screen's town, which Watch then plays.
 */
export interface LiveRun {
  runLive: () => void;
  /** False while a build or a refill runs, while Watch plays, or after a refused run. */
  available: boolean;
}

const LiveRunContext = createContext<LiveRun>({
  runLive: () => {},
  available: false,
});

/** The festival screen provides it; outside one, it is unavailable and does nothing. */
export const LiveRunProvider = LiveRunContext.Provider;

export const useLiveRun = (): LiveRun => useContext(LiveRunContext);
