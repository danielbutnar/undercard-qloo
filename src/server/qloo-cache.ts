import { Redis } from "@upstash/redis";

/**
 * Server-side cache for Qloo responses. Values stay on the server (Upstash Redis in deployed
 * builds, process memory otherwise); they are never written to the repository.
 */
export interface QlooCache {
  kind: "memory" | "upstash";
  get<T>(key: string): Promise<T | null>;
  /**
   * Like get, but an outage throws instead of reading as a miss, for a read that must tell "none"
   * from "couldn't read" (the build store's latest pointer). A cache without it is read with get.
   */
  getOrThrow?<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

/**
 * Cached data must outlive judging (it ends 2026-11-17 06:45 Europe/Bucharest), so entries
 * are kept through the end of 2026-11-18 UTC, and for at least 7 days after that date.
 */
export const CACHE_KEEP_UNTIL = Date.UTC(2026, 10, 19);
const MIN_TTL_SECONDS = 7 * 24 * 60 * 60;

export function cacheTtlSeconds(now: number = Date.now()): number {
  return Math.max(MIN_TTL_SECONDS, Math.ceil((CACHE_KEEP_UNTIL - now) / 1000));
}

export function createMemoryCache(now: () => number = Date.now): QlooCache {
  const entries = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    kind: "memory",
    async get<T>(key: string) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      return entry.value as T;
    },
    async set(key, value, ttlSeconds) {
      entries.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
    },
  };
}

/** The two Redis commands the cache needs; @upstash/redis's client provides both. */
export interface RedisLike {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, options: { ex: number }): Promise<unknown>;
}

// A cache outage must not fail a build, so Redis errors read as misses and skipped writes.
export function createUpstashCache(redis: RedisLike): QlooCache {
  return {
    kind: "upstash",
    async get<T>(key: string) {
      try {
        return ((await redis.get(key)) as T | null) ?? null;
      } catch {
        return null;
      }
    },
    async getOrThrow<T>(key: string) {
      return ((await redis.get(key)) as T | null) ?? null;
    },
    async set(key, value, ttlSeconds) {
      try {
        await redis.set(key, value, { ex: ttlSeconds });
      } catch {
        // Skipped: the next build fetches from Qloo again.
      }
    },
  };
}

/**
 * Set only for local e2e runs and design shots (playwright.config.ts); production never sets
 * it. The server then keeps everything in a memory cache seeded with the synthetic build and
 * model answer from tests/e2e/synthetic-build.ts, and never reaches Upstash, Qloo or Claude.
 * "1" seeds both; "empty" seeds no saved build, so the first screen falls back.
 */
export const SYNTHETIC_ENV = "UNDERCARD_E2E_SYNTHETIC";

export function syntheticMode(
  env: Partial<Record<string, string | undefined>> = process.env,
): boolean {
  return env[SYNTHETIC_ENV] === "1" || env[SYNTHETIC_ENV] === "empty";
}

let processMemory: QlooCache | null = null;
const syntheticMemory = new Map<string, QlooCache>();

// Reads wait for the seed; if seeding fails, every read fails too, so a route errors rather
// than falling through to a live call.
function seededSyntheticCache(mode: string): QlooCache {
  const existing = syntheticMemory.get(mode);
  if (existing) return existing;
  const memory = createMemoryCache();
  const seeded = import("./synthetic-seed").then(({ seedSynthetic }) =>
    seedSynthetic(memory, { savedBuild: mode !== "empty" }),
  );
  const cache: QlooCache = {
    kind: "memory",
    async get<T>(key: string) {
      await seeded;
      return memory.get<T>(key);
    },
    async set(key, value, ttlSeconds) {
      await seeded;
      await memory.set(key, value, ttlSeconds);
    },
  };
  syntheticMemory.set(mode, cache);
  return cache;
}

export function createQlooCache(
  env: Partial<Record<string, string | undefined>> = process.env,
): QlooCache {
  if (syntheticMode(env)) return seededSyntheticCache(env[SYNTHETIC_ENV]!);
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return createUpstashCache(new Redis({ url, token }));
  processMemory ??= createMemoryCache();
  return processMemory;
}
