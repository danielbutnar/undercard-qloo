// WS4, step 5, on the synthetic server: its seeded cache holds Boise's example the way
// scripts/shortlist-example.ts leaves a real cache, so the e2e meets the example from the cache
// alone, and the Without Qloo checks' one unchecked pick stays unchecked. Invented names.
import { describe, expect, it } from "vitest";
import {
  SYNTHETIC_UNCHECKED_PICK,
  syntheticLlmOnly,
} from "../../e2e/synthetic-build";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createQlooCache, SYNTHETIC_ENV } from "@/server/qloo-cache";
import { shortlistExample } from "@/server/shortlist";

describe("the synthetic server's shortlist example", () => {
  it("is the synthetic model's ten picks, sorted from the seeded cache", async () => {
    const example = await shortlistExample({
      festival: SAGEBRUSH_SOUND,
      cache: createQlooCache({ [SYNTHETIC_ENV]: "1" }),
    });

    expect(example?.names).toEqual(
      syntheticLlmOnly().lineup.picks.map((pick) => pick.name),
    );
    const acts = example?.shortlist?.acts ?? [];
    expect(acts[0]).toMatchObject({ qlooName: "Marigold Static", climb: 5 });
    expect(
      acts.find((act) => act.name === SYNTHETIC_UNCHECKED_PICK)?.status,
    ).toBe("not-checked");
    expect(acts.find((act) => act.name === "Fern & Fable")?.status).toBe(
      "not-found",
    );
    expect(
      example?.shortlist?.venues.find((venue) => venue.noFanData)?.name,
    ).toBe("Cottonwood Social Hall");
    expect(example?.shortlist?.made).toBe(0);
  });
});
