import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { TOWNS } from "@/lib/towns";
import {
  SYNTHETIC_UNCHECKED_PICK,
  syntheticLlmOnly,
  syntheticPickQloo,
  syntheticSavedBuild,
  syntheticTownBuild,
} from "../../tests/e2e/synthetic-build";
import { createBuildStore } from "./build-store";
import { handleLlmOnly } from "./llm-only";
import { createQlooClient } from "./qloo";
import type { QlooCache } from "./qloo-cache";
import { createMemoryLimiter } from "./rate-limit";
import { assemblyFromSaved } from "./venue-switch";

/**
 * Seeds a memory cache for synthetic mode (UNDERCARD_E2E_SYNTHETIC): the synthetic build as
 * the festival's latest (left out with "empty", for the fallback), and the synthetic model
 * answer as LLM only's saved answer, each saved the way a real build and a real answer are.
 * With the build come the Qloo answers its Without Qloo checks read (prompt-4): its venue
 * lists and every pick's search but one, cached by a client whose fetch answers from the
 * invented data, never the network. Loaded only in synthetic mode.
 */
export async function seedSynthetic(
  cache: QlooCache,
  { savedBuild }: { savedBuild: boolean },
): Promise<void> {
  if (savedBuild) {
    const store = createBuildStore(cache);
    await store.save(syntheticSavedBuild());
    // The same synthetic bill under each other town's id, so the town switcher has towns;
    // Nashville's trace has the planner switch venue (WS2).
    for (const town of TOWNS.slice(1))
      await store.save(syntheticTownBuild(town.slug, town.festival.id));
  }
  const picks = syntheticLlmOnly().lineup.picks;
  await handleLlmOnly({
    festival: SAGEBRUSH_SOUND,
    cache,
    limiter: createMemoryLimiter(),
    ip: "synthetic",
    model: () => ({ suggest: async () => picks }),
  });
  if (savedBuild) {
    const qloo = createQlooClient({
      apiKey: "synthetic",
      cache,
      fetch: async (input) =>
        Response.json(syntheticPickQloo(new URL(String(input)))),
    });
    await assemblyFromSaved(syntheticSavedBuild(), SAGEBRUSH_SOUND, qloo);
    for (const pick of picks)
      if (pick.name !== SYNTHETIC_UNCHECKED_PICK)
        await qloo.search({ query: pick.name });
  }
}
