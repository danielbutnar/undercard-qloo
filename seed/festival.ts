// The seeded demo festival, built deterministically: the same output on every run.
// Imports use .ts paths so `node seed/seed.ts` can run them with Node's type stripping.
import type { Festival } from "../src/lib/festival.ts";
import { presaleSeries } from "../src/lib/presale.ts";

/** Where `pnpm seed` writes the data the app loads. */
export const SEED_FILE = "seed/sagebrush-sound.json";

/** The fixed random seed behind the 30 days of synthetic presale. */
export const PRESALE_SEED = 20260916;
const CAPACITY = 3000;

/**
 * Sagebrush Sound is fictional; its headliners are real artists so the agent can resolve
 * them through Qloo /search. The fee bands are the buyer's estimates (SPEC.md section 7).
 */
export function buildSeed(): Festival {
  return {
    id: "sagebrush-sound",
    name: "Sagebrush Sound",
    city: "Boise",
    region: "Idaho",
    capacity: CAPACITY,
    crowdAge: { min: 25, max: 34 },
    headliners: ["Khruangbin", "Japanese Breakfast"],
    feeBands: [
      {
        id: "mid",
        label: "Mid",
        minPopularity: 0.8,
        maxPopularity: 0.92,
        slots: 4,
      },
      {
        id: "opener",
        label: "Opener",
        minPopularity: 0.55,
        maxPopularity: 0.8,
        slots: 6,
      },
    ],
    presale: presaleSeries({
      seed: PRESALE_SEED,
      startDate: "2026-09-16",
      days: 30,
      capacity: CAPACITY,
    }),
  };
}

export function seedJson(festival: Festival): string {
  return `${JSON.stringify(festival, null, 2)}\n`;
}
