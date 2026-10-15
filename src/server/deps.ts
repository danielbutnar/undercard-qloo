import { Redis } from "@upstash/redis";
import { AiNotConfigured, createAgentModel } from "./ai";
import { createBuildStore } from "./build-store";
import { createQlooClient, type QlooClient } from "./qloo";
import { createQlooCache } from "./qloo-cache";
import {
  createMemoryLimiter,
  createUpstashLimiter,
  type RateLimiter,
} from "./rate-limit";

/** The route handlers' server wiring: keys from the environment, one shared cache. */

export function serverQloo(): QlooClient | null {
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) return null;
  return createQlooClient({
    apiKey,
    cache: createQlooCache(),
    baseUrl: process.env.QLOO_BASE_URL || undefined,
  });
}

export function serverModel() {
  try {
    return createAgentModel();
  } catch (error) {
    if (error instanceof AiNotConfigured) return null;
    throw error;
  }
}

export function serverBuildStore() {
  return createBuildStore(createQlooCache());
}

let processLimiter: RateLimiter | null = null;

/** Upstash-backed daily limits when Upstash is set; process memory otherwise. */
export function serverLimiter(
  env: Partial<Record<string, string | undefined>> = process.env,
): RateLimiter {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return createUpstashLimiter(new Redis({ url, token }));
  processLimiter ??= createMemoryLimiter();
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
