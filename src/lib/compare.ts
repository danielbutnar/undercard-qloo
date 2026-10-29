import type { Act } from "./lineup";

/**
 * Town against town (M9b): the same brief in two towns, side by side. The default pair is the
 * first checked town whose saved lineup shares at least one act with Boise's and differs in at
 * least three (docs/evidence.md section 20): Austin, 3 shared and 7 its own, on Undercard 1.0's
 * builds of 17 October (pinned in src/data/pinned-builds-2026-10-21.json).
 */
export const DEFAULT_COMPARE = {
  a: "sagebrush-sound",
  b: "sagebrush-sound-austin",
} as const;

export function compareBills(
  a: readonly Act[],
  b: readonly Act[],
): { shared: Set<string>; onlyA: Act[]; onlyB: Act[] } {
  const inA = new Set(a.map((act) => act.entityId));
  const inB = new Set(b.map((act) => act.entityId));
  const shared = new Set([...inA].filter((id) => inB.has(id)));
  return {
    shared,
    onlyA: a.filter((act) => !shared.has(act.entityId)),
    onlyB: b.filter((act) => !shared.has(act.entityId)),
  };
}
