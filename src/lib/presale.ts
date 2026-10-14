import type { PresaleDay } from "./festival";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PresaleOptions {
  seed: number;
  /** First presale day, yyyy-mm-dd (UTC). */
  startDate: string;
  days: number;
  capacity: number;
}

// mulberry32: a small seeded generator, so the same seed always yields the same series.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Synthetic daily presale counts: an on-sale spike that decays into steady sales, with
 * Friday-to-Sunday lifts and seeded noise. Demo data only; it forecasts nothing.
 */
export function presaleSeries({
  seed,
  startDate,
  days,
  capacity,
}: PresaleOptions): PresaleDay[] {
  const random = seededRandom(seed);
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const onSaleSpike = capacity * 0.06;
  const steadyDaily = capacity * 0.008;

  return Array.from({ length: days }, (_, day) => {
    const date = new Date(start + day * DAY_MS);
    const weekday = date.getUTCDay();
    const weekendLift = weekday === 0 || weekday >= 5 ? 1.35 : 1;
    const expected =
      (steadyDaily + onSaleSpike * Math.exp(-day / 2.5)) * weekendLift;
    const noise = 0.75 + random() * 0.5;
    return {
      date: date.toISOString().slice(0, 10),
      sold: Math.round(expected * noise),
    };
  });
}
