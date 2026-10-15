import { describe, expect, it } from "vitest";
import {
  createMemoryCache,
  createQlooCache,
  createUpstashCache,
} from "@/server/qloo-cache";

describe("memory cache", () => {
  it("returns a stored value until its time to live runs out", async () => {
    let now = 1_000_000;
    const cache = createMemoryCache(() => now);
    await cache.set("k", { a: 1 }, 60);
    expect(await cache.get("k")).toEqual({ a: 1 });
    now += 61_000;
    expect(await cache.get("k")).toBeNull();
  });
});

describe("Upstash cache", () => {
  it("stores values with an expiry and reads them back", async () => {
    const store = new Map<string, unknown>();
    const expiries = new Map<string, number>();
    const redis = {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: unknown, options: { ex: number }) => {
        store.set(key, value);
        expiries.set(key, options.ex);
        return "OK";
      },
    };
    const cache = createUpstashCache(redis);
    await cache.set("qloo:k", { a: 1 }, 3600);
    expect(await cache.get("qloo:k")).toEqual({ a: 1 });
    expect(expiries.get("qloo:k")).toBe(3600);
  });

  it("treats a Redis failure as a cache miss instead of failing the build", async () => {
    const redis = {
      get: async () => {
        throw new Error("network");
      },
      set: async () => {
        throw new Error("network");
      },
    };
    const cache = createUpstashCache(redis);
    expect(await cache.get("qloo:k")).toBeNull();
    await expect(cache.set("qloo:k", 1, 60)).resolves.toBeUndefined();
  });
});

describe("createQlooCache", () => {
  it("uses Upstash when its URL and token are set", () => {
    const cache = createQlooCache({
      UPSTASH_REDIS_REST_URL: "https://synthetic-cache.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "synthetic-token",
    });
    expect(cache.kind).toBe("upstash");
  });

  it("falls back to memory without Upstash settings", () => {
    expect(createQlooCache({}).kind).toBe("memory");
  });
});
