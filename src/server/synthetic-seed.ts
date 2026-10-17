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
 * Seeds a memory cache for synthetic mode (UNDERCARD_E2E_SYNTHETIC): the synthetic build as
 * the festival's latest (left out with "empty", for the fallback), and the synthetic model
 * answer as LLM only's saved answer, each saved the way a real build and a real answer are.
 * Loaded only in synthetic mode.
 */
export async function seedSynthetic(
  cache: QlooCache,
  { savedBuild }: { savedBuild: boolean },
): Promise<void> {
  if (savedBuild) await createBuildStore(cache).save(syntheticSavedBuild());
  const picks = syntheticLlmOnly().lineup.picks;
  await handleLlmOnly({
    festival: SAGEBRUSH_SOUND,
    cache,
    limiter: createMemoryLimiter(),
    ip: "synthetic",
    model: () => ({ suggest: async () => picks }),
  });
}
