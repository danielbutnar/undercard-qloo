// A first bill made from the synthetic lineup fixture: invented acts and venues, no Qloo data.
import fixture from "../../fixtures/lineup.synthetic.json";
import type { FirstBill } from "@/lib/first-bill";
import { LineupSchema } from "@/lib/lineup";

export const { acts } = LineupSchema.parse(fixture);
const venue = (n: number, name: string) => ({
  entityId: `00000000-0000-4000-8000-000000000${n}`,
  name,
});
export const LANTERN = venue(201, "The Lantern Room");
export const FORT = venue(202, "Fort Street Ballroom");
export const COTTONWOOD = venue(203, "Cottonwood Social Hall");
export const FIRST_BILL: FirstBill = {
  build: { id: "synthetic-build", createdAt: "2026-10-15T14:02:00.000Z" },
  acts,
  calls: 12,
  placesListed: 8,
  anchors: {
    mid: [LANTERN, FORT, COTTONWOOD],
    opener: [LANTERN, FORT],
  },
  baselineTop: { mid: 50, opener: 50 },
};
