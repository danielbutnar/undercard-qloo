import { z } from "zod";
import type { FeeBand, FeeBandId } from "./fee-bands";

/**
 * The running order (M8a; docs/evidence.md section 15): two stages, Openers early and Mid acts
 * later, two acts on at a time. Within each band the acts are paired so the two playing at the
 * same time share the least audience, by Qloo's affinity of one act's fans for the other.
 */
export const OrderActSchema = z.object({
  entityId: z.string(),
  name: z.string(),
  popularity: z.number(),
});

export const RunningSlotSchema = z.object({
  band: z.enum(["mid", "opener"]),
  /** The bigger draw of the two, on the main stage. */
  main: OrderActSchema,
  /** Who plays against it on the second stage; null when the band has an odd act out. */
  second: OrderActSchema.nullable(),
  /**
   * How close the two acts' fans' tastes are: Qloo affinity (how much fans of one act also like
   * the other), 0 to 1; null when Qloo gave none. Not a count of shared ticket buyers.
   */
  shared: z.number().nullable(),
  /** The pair's place among the lineup's scored pairs, 1 for the closest (M6r). */
  rank: z.number().int().positive().nullable().default(null),
  /** How many pairs on the lineup were scored. */
  pairs: z.number().int().nonnegative().default(0),
});

export type RunningSlot = z.infer<typeof RunningSlotSchema>;
type OrderAct = z.infer<typeof OrderActSchema> & { band: FeeBandId };

/** Every way to pair the acts up (with one act alone when the count is odd). */
function pairings<T>(items: readonly T[]): [T, T | null][][] {
  if (items.length === 0) return [[]];
  if (items.length === 1) return [[[items[0], null]]];
  const [first, ...rest] = items;
  const out: [T, T | null][][] = [];
  for (let i = 0; i < rest.length; i++) {
    const others = rest.filter((_, j) => j !== i);
    for (const tail of pairings(others)) out.push([[first, rest[i]], ...tail]);
  }
  // An odd count leaves one act alone: try each act as that one.
  if (items.length % 2 === 1)
    for (const tail of pairings(rest)) {
      if (tail.some(([, b]) => b === null)) continue;
      out.push([[first, null], ...tail]);
    }
  return out;
}

/**
 * Plans the sets: per band, the pairing whose clashes share the least audience in total; each
 * pair's bigger draw on the main stage; pairs in order of their draw, so the bigger acts play
 * later, Openers before Mid acts. A pair Qloo gave no score for counts as sharing the most.
 */
export function planRunningOrder(
  acts: readonly OrderAct[],
  shared: (a: string, b: string) => number | null,
  bands: readonly FeeBand[],
): RunningSlot[] {
  const order: FeeBandId[] = [...bands]
    .sort((a, b) => a.minPopularity - b.minPopularity)
    .map((band) => band.id);
  // Every scored pair in a band, so each clash can be ranked within the lineup (M6r).
  const scored: number[] = [];
  for (const band of order) {
    const inBand = acts.filter((act) => act.band === band);
    for (let i = 0; i < inBand.length; i++)
      for (let j = i + 1; j < inBand.length; j++) {
        const score = shared(inBand[i].entityId, inBand[j].entityId);
        if (score !== null) scored.push(score);
      }
  }
  const rankOf = (score: number | null) =>
    score === null ? null : 1 + scored.filter((other) => other > score).length;
  const slots: RunningSlot[] = [];
  for (const band of order) {
    const inBand = acts.filter((act) => act.band === band);
    const cost = (a: OrderAct, b: OrderAct | null) =>
      b === null ? 0 : (shared(a.entityId, b.entityId) ?? 1);
    let best: [OrderAct, OrderAct | null][] = [];
    let bestCost = Infinity;
    for (const pairing of pairings(inBand)) {
      const total = pairing.reduce((sum, [a, b]) => sum + cost(a, b), 0);
      if (total < bestCost) {
        bestCost = total;
        best = pairing;
      }
    }
    const draw = ([a, b]: [OrderAct, OrderAct | null]) =>
      b ? (a.popularity + b.popularity) / 2 : a.popularity;
    for (const [a, b] of [...best].sort((x, y) => draw(x) - draw(y))) {
      const [main, second] = b && b.popularity > a.popularity ? [b, a] : [a, b];
      const pick = ({ entityId, name, popularity }: OrderAct) => ({
        entityId,
        name,
        popularity,
      });
      const score = second ? shared(main.entityId, second.entityId) : null;
      slots.push({
        band,
        main: pick(main),
        second: second ? pick(second) : null,
        shared: score,
        rank: rankOf(score),
        pairs: scored.length,
      });
    }
  }
  return slots;
}
