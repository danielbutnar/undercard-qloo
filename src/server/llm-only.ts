import type { Festival } from "@/lib/festival";
import {
  LlmOnlyLineupSchema,
  type LlmOnlyLineup,
  type PickCheck,
} from "@/lib/llm-only";
import { festivalBrief } from "./agent";
import type { LlmOnlyModel } from "./ai";
import { cacheTtlSeconds, type QlooCache } from "./qloo-cache";
import type { RateLimiter } from "./rate-limit";

// v2 since 2026-10-17: the baseline runs at high effort, so answers saved at low effort
// under v1 aren't served again.
const PREFIX = "undercard:llm-only:v2:";
const SLOTS = 10;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * POST /api/llm-only: the same festival brief answered by the model alone, for comparison
 * with the Qloo board. The answer is saved as long as Qloo data is, so the model is asked
 * once per festival. Asking the model is rate-limited per IP and per day; the saved answer
 * is not. With `checks`, each pick's checks on Qloo come with the answer
 * (src/server/pick-checks.ts); if they fail, the answer comes without them.
 */
export async function handleLlmOnly({
  festival,
  model,
  cache,
  limiter,
  ip,
  now = Date.now,
  checks,
}: {
  festival: Festival;
  model: () => LlmOnlyModel | null;
  cache: QlooCache;
  limiter: RateLimiter;
  ip: string;
  now?: () => number;
  checks?: (lineup: LlmOnlyLineup) => Promise<PickCheck[]>;
}): Promise<Response> {
  const withChecks = async (lineup: LlmOnlyLineup) => {
    if (!checks) return {};
    try {
      return { checks: await checks(lineup) };
    } catch {
      return {};
    }
  };
  const key = `${PREFIX}${festival.id}`;
  const saved = LlmOnlyLineupSchema.safeParse(await cache.get(key));
  if (saved.success)
    return json({
      lineup: saved.data,
      cached: true,
      ...(await withChecks(saved.data)),
    });

  const llm = model();
  if (!llm)
    return json({ error: "The model isn't configured on this server." }, 503);

  const verdict = await limiter.check("llmOnly", ip);
  if (!verdict.allowed) {
    return Response.json(
      { error: verdict.message },
      {
        status: 429,
        headers: {
          "cache-control": "no-store",
          "retry-after": String(verdict.retryAfterSeconds),
        },
      },
    );
  }

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
  return json({ lineup, cached: false, ...(await withChecks(lineup)) });
}
