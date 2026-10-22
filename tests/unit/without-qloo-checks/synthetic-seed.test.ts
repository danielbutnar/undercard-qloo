// Daniel's brief of 2026-10-22 (prompt-4), step 4: the synthetic server's cache holds what the
// Without Qloo checks read (the synthetic build's venue lists and every pick's search but one),
// seeded the way real answers sit there, so the e2e on the synthetic build meets each kind of
// line. Invented names and numbers.
import { describe, expect, it } from "vitest";
import {
  SYNTHETIC_UNCHECKED_PICK,
  syntheticLlmOnly,
} from "../../e2e/synthetic-build";
import type { PickCheck } from "@/lib/llm-only";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore } from "@/server/build-store";
import { pickChecks } from "@/server/pick-checks";
import { createQlooCache, SYNTHETIC_ENV } from "@/server/qloo-cache";

describe("the synthetic server's Qloo answers for the Without Qloo checks", () => {
  it("leave one pick unchecked and read the rest: not found, in, above and below the range, and one climb", async () => {
    const cache = createQlooCache({ [SYNTHETIC_ENV]: "1" });
    const checks = await pickChecks({
      answer: syntheticLlmOnly().lineup,
      build: await createBuildStore(cache).latest(SAGEBRUSH_SOUND.id),
      festival: SAGEBRUSH_SOUND,
      cache,
    });
    const names = (keep: (check: PickCheck) => boolean) =>
      checks.filter(keep).map((check) => check.name);

    expect(names((check) => check.status === "not-checked")).toEqual([
      SYNTHETIC_UNCHECKED_PICK,
    ]);
    expect(names((check) => check.status === "not-found")).toEqual([
      "Fern & Fable",
    ]);
    const found = checks.filter((check) => check.status === "found");
    expect(found).toHaveLength(8);
    expect(new Set(found.map((check) => check.range))).toEqual(
      new Set(["in", "above", "below"]),
    );
    expect(
      names(
        (check) =>
          check.status === "found" && check.climb !== null && check.climb > 0,
      ),
    ).toEqual(["Marigold Static"]);
    expect(checks.find((check) => check.name === "Velvet Coyote")).toEqual({
      name: "Velvet Coyote",
      status: "found",
      popularity: 0.963,
      range: "above",
      genres: 2,
      climb: null,
    });
  });
});
