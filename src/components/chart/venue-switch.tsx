/*
 * A venue's line as the first screen counts it: the venue switch's panel ("Switch a venue off")
 * that drew these lines went with WS12 item 1, and its component with item 7; the poster's key
 * and the town's signs say the same now.
 */
export interface VenueLine {
  entityId: string;
  name: string;
  /** Its colour on the chart (src/lib/venue-colours.ts). */
  hue: number;
  /** Acts on the lineup its fans lifted, as the lineup stands. */
  lifted: number;
  /** "an arena", "a festival"…, when it isn't a club (M6l). */
  kind?: string;
  /** Qloo had no fan data for it (WS8): said as its sign says it. */
  noFanData?: boolean;
}
