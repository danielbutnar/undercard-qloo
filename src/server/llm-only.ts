import type { Festival } from "@/lib/festival";
import { LlmOnlyLineupSchema, type LlmOnlyLineup } from "@/lib/llm-only";
import { festivalBrief } from "./agent";
import type { LlmOnlyModel } from "./ai";
import { cacheTtlSeconds, type QlooCache } from "./qloo-cache";

const PREFIX = "undercard:llm-only:v1:";
const SLOTS = 10;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * POST /api/llm-only: the same festival brief answered by the model alone, for comparison
 * with the Qloo board. The answer is saved as long as Qloo data is, so the model is asked
 * once per festival.
 */
export async function handleLlmOnly({
  festival,
  model,
  cache,
  now = Date.now,
}: {
  festival: Festival;
  model: () => LlmOnlyModel | null;
  cache: QlooCache;
  now?: () => number;
}): Promise<Response> {
  const key = `${PREFIX}${festival.id}`;
  const saved = LlmOnlyLineupSchema.safeParse(await cache.get(key));
  if (saved.success) return json({ lineup: saved.data, cached: true });

  const llm = model();
  if (!llm)
    return json({ error: "The model isn't configured on this server." }, 503);

  let picks;
  try {
    picks = await llm.suggest(festivalBrief(festival));
  } catch {
    return json(
      { error: "The model didn't answer. Try again in a minute." },
      502,
    );
  }
  const headliners = new Set(
    festival.headliners.map((name) => name.toLowerCase()),
  );
  const lineup: LlmOnlyLineup = {
    festivalId: festival.id,
    createdAt: new Date(now()).toISOString(),
    picks: picks
      .filter((pick) => !headliners.has(pick.name.trim().toLowerCase()))
      .slice(0, SLOTS),
  };
  await cache.set(key, lineup, cacheTtlSeconds(now()));
  return json({ lineup, cached: false });
}
