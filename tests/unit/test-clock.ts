// The screen tests' own clock (Daniel, 2026-10-28; tests/unit/m4b/motion.test.tsx is the model).
// A test fakes the timers (setTimeout, setInterval and their clears) in beforeEach and puts the
// real ones back after cleanup(); promises, the streams and React's renders still run for real.
import { vi } from "vitest";

/**
 * A slow machine, simulated on the clock: every answer arrives this long after its request.
 * Longer than any wall-clock wait these screens' tests used to allow (8 s and 12 s), so a wait
 * on the wall clock fails here; on the test's own clock it costs one step.
 */
export const SLOW_MS = 15_000;

/** The slow machine's delay before a stubbed answer: nothing at full speed. */
export async function lag(latency: number) {
  if (latency) await new Promise((resolve) => setTimeout(resolve, latency));
}

/**
 * Waits for `check` to pass on the test's own clock, never the wall clock: between checks it
 * moves the fake clock to the page's next timer, if there is one, and gives the stream and
 * React's scheduler a few real turns of the event loop. It gives up after 100 such steps,
 * however long the machine takes. As Testing Library's waitFor does, React runs outside act()
 * meanwhile: act() would wait for work that waits for the clock. A check uses queryAll* and
 * expect, never getBy*: a miss there dumps the whole page, about half a second each time.
 */
export async function settle(check: () => void) {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const actEnvironment = scope.IS_REACT_ACT_ENVIRONMENT;
  scope.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    for (let step = 0; ; step++) {
      try {
        check();
        return;
      } catch (error) {
        if (step >= 100) throw error;
      }
      await vi.advanceTimersToNextTimerAsync();
      for (let turn = 0; turn < 3; turn++)
        await new Promise((resolve) => setImmediate(resolve));
    }
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
  }
}
