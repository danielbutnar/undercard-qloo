import type { Festival } from "@/lib/festival";
import type { LlmOnlyLineup, PickCheck } from "@/lib/llm-only";
import { foundOnQloo, pickTests } from "@/lib/pick-tests";
import { createBuildStore, type SavedBuild } from "./build-store";
import { createQlooClient, QlooCacheMiss } from "./qloo";
import { createQlooCache, type QlooCache } from "./qloo-cache";
import { assemblyFromSaved } from "./venue-switch";

/**
 * Each pick of a saved model answer on Qloo, for its Without Qloo card (docs/evidence.md
 * section 31): found or not in search's top five, then the three tests against the saved
 * build's own lists. Read through a cache-only client whose fetch throws, as evidence 19's
 * replays are, so it never calls Qloo and never writes the cache; the model isn't asked. A
 * pick whose search the cache doesn't hold, or every pick when the build's lists aren't there,
 * is "not-checked".
 */
export async function pickChecks({
  answer,
  build,
  festival,
  cache,
}: {
  answer: LlmOnlyLineup;
  build: SavedBuild | null;
  festival: Festival;
  cache: QlooCache;
}): Promise<PickCheck[]> {
  const qloo = createQlooClient({
    apiKey: "",
    cache,
    cacheOnly: true,
    fetch: async () => {
      throw new Error("The Without Qloo checks read the Qloo cache only.");
    },
  });
  const input =
    build && build.festivalId === festival.id
      ? await assemblyFromSaved(build, festival, qloo)
      : null;
  return Promise.all(
    answer.picks.map(async ({ name }): Promise<PickCheck> => {
      if (!input) return { name, status: "not-checked" };
      let found;
      try {
        found = foundOnQloo(name, (await qloo.search({ query: name })).data);
      } catch (error) {
        if (error instanceof QlooCacheMiss)
          return { name, status: "not-checked" };
        throw error;
      }
      if (!found) return { name, status: "not-found" };
      const { range, genres, climb } = pickTests(input, found);
      return {
        name,
        status: "found",
        popularity: found.popularity,
        range,
        genres,
        climb,
      };
    }),
  );
}

/**
 * The checks POST /api/llm-only serves with a festival's answer: against the festival's latest
 * saved build, from the server's Qloo cache (the seeded memory cache in synthetic mode).
 */
export async function savedPickChecks(
  festival: Festival,
  answer: LlmOnlyLineup,
): Promise<PickCheck[]> {
  const cache = createQlooCache();
  return pickChecks({
    answer,
    build: await createBuildStore(cache).latest(festival.id),
    festival,
    cache,
  });
}
