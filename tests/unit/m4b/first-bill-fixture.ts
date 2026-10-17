// A first bill made from the synthetic lineup fixture: invented acts and venues, no Qloo data.
import fixture from "../../fixtures/lineup.synthetic.json";
import type { FirstBill } from "@/lib/first-bill";
import { LineupSchema } from "@/lib/lineup";

export const { acts } = LineupSchema.parse(fixture);
export const FIRST_BILL: FirstBill = {
  build: { id: "synthetic-build", createdAt: "2026-10-15T14:02:00.000Z" },
  acts,
  calls: 12,
  placesListed: 8,
  anchors: {
    mid: [
      {
        entityId: "00000000-0000-4000-8000-000000000201",
        name: "The Lantern Room",
      },
    ],
  },
  baselineTop: { mid: 50, opener: 50 },
};

