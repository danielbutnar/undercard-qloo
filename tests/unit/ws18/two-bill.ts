// A 2.0 first bill for WS18's tests: the synthetic lineup's acts (invented, no Qloo data), each
// with its place and both climbs, as Agent 2.0's saved builds carry them. Every act's climb with
// its venue is its poster's climb; its control climbs or falls by turns.
import type { FirstBill } from "@/lib/first-bill";
import { liftOf } from "@/lib/marks";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

const climbOf = (act: (typeof acts)[number]) => {
  const lift = liftOf(act);
  return lift?.kind === "up" ? lift.places : 50 - (lift?.top ?? 40);
};

export const TWO_ACTS = acts.map((act, n) => ({
  ...act,
  localLift: {
    venueClimb: climbOf(act),
    controlClimb: n % 2 ? -15 : 2,
    control: {
      entityId: `00000000-0000-4000-8000-0000000003${String(n).padStart(2, "0")}`,
      name: "Sala Abroad",
      town: "Elsewhere",
    },
  },
}));

export const TWO_PLACES = Object.fromEntries(
  TWO_ACTS.map((act) => {
    const lift = liftOf(act);
    const now = 3 + (TWO_ACTS.indexOf(act) % 6);
    return [
      act.entityId,
      lift?.kind === "up"
        ? { now, was: now + lift.places }
        : { now, was: null },
    ];
  }),
);

export const TWO_BILL: FirstBill = {
  ...FIRST_BILL,
  acts: TWO_ACTS,
  places: TWO_PLACES,
};
