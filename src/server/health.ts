import { createHash, timingSafeEqual } from "node:crypto";
import type { HealthModel } from "./ai";
import type { QlooClient } from "./qloo";
import type { RateLimiter } from "./rate-limit";

/** The check's one Qloo search: the demo's first headliner, the agent's own first call. */
export const HEALTH_QUERY = "Khruangbin";

export type HealthVerdict = "ok" | "fail";

export interface DeepHealth {
  qloo: HealthVerdict;
  anthropic: HealthVerdict;
  /** Both calls, made together, in milliseconds. */
  ms: number;
}

const json = (
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });

const digest = (text: string) => createHash("sha256").update(text).digest();

/** The request's bearer token against the configured one, compared in constant time. */
function authorized(header: string | null, token: string): boolean {
  const given = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "")?.[1];
  return given !== undefined && timingSafeEqual(digest(given), digest(token));
}

/** ok or fail, and nothing else: no part of an answer or an error is logged or kept. */
async function verdict(check: () => Promise<boolean>): Promise<HealthVerdict> {
  try {
    return (await check()) ? "ok" : "fail";
  } catch {
    return "fail";
  }
}

/**
 * GET /api/health/deep: whether Qloo and the model answer, for the daily smoke workflow. It
 * needs the bearer token in HEALTH_TOKEN (404 while that is unset, 401 when the token is missing
 * or wrong) and is limited per IP and per day. It makes exactly two calls, together: one Qloo
 * /search for a fixed query through a client that skips the Qloo cache (serverUncachedQloo,
 * with the usual retries), and one one-token model call (createHealthModel). It returns only ok
 * or fail for each, and the time; it logs and stores nothing.
 */
export async function handleDeepHealth({
  token,
  authorization,
  qloo,
  model,
  limiter,
  ip,
  clock = Date.now,
}: {
  /** HEALTH_TOKEN; the route answers 404 while it is unset or blank. */
  token: string | undefined;
  authorization: string | null;
  /** A Qloo client that skips the cache; null when Qloo isn't configured. */
  qloo: () => QlooClient | null;
  /** The one-token model call; null when the model isn't configured. */
  model: () => HealthModel | null;
  limiter: RateLimiter;
  ip: string;
  clock?: () => number;
}): Promise<Response> {
  const expected = token?.trim();
  if (!expected) return json({ error: "Not found." }, 404);
  if (!authorized(authorization, expected))
    return json({ error: "Unauthorized." }, 401, {
      "www-authenticate": "Bearer",
    });

  // Only a caller with the token spends one of the day's checks.
  const allowance = await limiter.check("health", ip);
  if (!allowance.allowed)
    return json({ error: allowance.message }, 429, {
      "retry-after": String(allowance.retryAfterSeconds),
    });

  const started = clock();
  const [qlooVerdict, anthropicVerdict] = await Promise.all([
    verdict(async () => {
      const client = qloo();
      if (!client) return false;
      const { data } = await client.search({ query: HEALTH_QUERY });
      return data.length > 0;
    }),
    verdict(async () => {
      const ping = model();
      if (!ping) return false;
      await ping.ping();
      return true;
    }),
  ]);
  const body: DeepHealth = {
    qloo: qlooVerdict,
    anthropic: anthropicVerdict,
    ms: Math.max(0, Math.round(clock() - started)),
  };
  return json(body, 200);
}
