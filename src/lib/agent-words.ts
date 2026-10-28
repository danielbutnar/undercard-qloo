/**
 * Agent 2.0's words (WS13): the lines its new trace data gives the Qloo calls list, Watch and the
 * setlist. WS13 writes them; where they sit on a page is WS12's.
 */

/** A venue read's line, when Qloo had no fan data for the venue (WS13.1). */
export const noFanDataCallLine = (venue: string) =>
  `Qloo had no fan data for ${venue}: the agent skips it.`;
