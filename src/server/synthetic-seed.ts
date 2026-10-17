import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import {
  syntheticLlmOnly,
  syntheticSavedBuild,
} from "../../tests/e2e/synthetic-build";
import { createBuildStore } from "./build-store";
import { handleLlmOnly } from "./llm-only";
import type { QlooCache } from "./qloo-cache";
import { createMemoryLimiter } from "./rate-limit";

/**
 * Seeds a memory cache for synthetic mode (UNDERCARD_E2E_SYNTHETIC=1): the synthetic build as
 * the festival's latest, and the synthetic model answer as LLM only's saved answer, saved
 * through the same paths a real build and a real answer take. Loaded only in synthetic mode.
 */
export async function seedSynthetic(cache: QlooCache): Promise<void> {
  await createBuildStore(cache).save(syntheticSavedBuild());
  const picks = syntheticLlmOnly().lineup.picks;
  await handleLlmOnly({
    festival: SAGEBRUSH_SOUND,
    cache,
    limiter: createMemoryLimiter(),
    ip: "synthetic",
    model: () => ({ suggest: async () => picks }),
  });
}
