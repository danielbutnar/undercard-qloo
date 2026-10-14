import type { Festival } from "./festival";
import { presaleSeries } from "./presale";

const CAPACITY = 3000;

/**
 * The seeded demo festival. Sagebrush Sound is fictional; its headliners are real artists so
 * the agent can resolve them through Qloo /search. Fee bands are the buyer's estimates, to be
 * tuned at the M2 spike.
 */
export const SAGEBRUSH_SOUND: Festival = {
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
    seed: 20260916,
    startDate: "2026-09-16",
    days: 30,
    capacity: CAPACITY,
  }),
};
