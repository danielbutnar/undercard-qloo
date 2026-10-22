import { Redis } from "@upstash/redis";
import { AiNotConfigured, createAgentModel, createHealthModel } from "./ai";
import { createBuildStore, previewSafe } from "./build-store";
import {
  createQlooClient,
  type QlooClient,
  type QlooClientOptions,
} from "./qloo";
import { createQlooCache, NO_CACHE, syntheticMode } from "./qloo-cache";
import {
  createMemoryLimiter,
  createUpstashLimiter,
  limitsFrom,
  type RateLimiter,
} from "./rate-limit";

/**
 * The route handlers' server wiring: keys from the environment, one shared cache. In synthetic
 * mode (local e2e runs and design shots) there is no Qloo client and no model, so a test run
 * can't spend a Qloo or Claude call or replace the saved build.
 */

export function serverQloo(): QlooClient | null {
  if (syntheticMode()) return null;
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) return null;
  return createQlooClient({
    apiKey,
    cache: createQlooCache(),
    baseUrl: process.env.QLOO_BASE_URL || undefined,
  });
}

/** Reads the Qloo cache only (M9a's replays): it never calls Qloo, so a replay stays free. */
export function serverCachedQloo(): QlooClient | null {
  if (syntheticMode()) return null;
  return createQlooClient({
    apiKey: process.env.QLOO_API_KEY ?? "",
    cache: createQlooCache(),
    baseUrl: process.env.QLOO_BASE_URL || undefined,
    cacheOnly: true,
  });
}

/**
 * Neither reads nor writes the Qloo cache (the deep health check): every call reaches Qloo,
 * with the usual retries and budget. Tests pass their own fetch and clock.
 */
export function serverUncachedQloo(
  env: Partial<Record<string, string | undefined>> = process.env,
  testing: Pick<QlooClientOptions, "fetch" | "sleep" | "clock" | "random"> = {},
): QlooClient | null {
  if (syntheticMode(env)) return null;
  const apiKey = env.QLOO_API_KEY;
  if (!apiKey) return null;
  return createQlooClient({
    apiKey,
    cache: NO_CACHE,
    baseUrl: env.QLOO_BASE_URL || undefined,
    ...testing,
  });
}

export function serverModel() {
  if (syntheticMode()) return null;
  try {
    return createAgentModel();
  } catch (error) {
    if (error instanceof AiNotConfigured) return null;
    throw error;
  }
}

/** The deep health check's one-token model call; null without a key and in synthetic mode. */
export function serverHealthModel() {
  if (syntheticMode()) return null;
  try {
    return createHealthModel();
  } catch (error) {
    if (error instanceof AiNotConfigured) return null;
    throw error;
  }
}

export function serverBuildStore() {
  return previewSafe(createBuildStore(createQlooCache()));
}

let processLimiter: RateLimiter | null = null;

/** Upstash-backed daily limits when Upstash is set; process memory otherwise. */
export function serverLimiter(
  env: Partial<Record<string, string | undefined>> = process.env,
): RateLimiter {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token && !syntheticMode(env))
    return createUpstashLimiter(new Redis({ url, token }), limitsFrom(env));
  processLimiter ??= createMemoryLimiter({ limits: limitsFrom(env) });
  return processLimiter;
}

/** Reads a small JSON body; an empty or invalid body reads as {}. */
export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
