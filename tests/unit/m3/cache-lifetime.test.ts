import { describe, expect, it } from "vitest";
import {
  CACHE_KEEP_UNTIL,
  cacheTtlSeconds,
  type QlooCache,
} from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";

const DAY = 24 * 60 * 60;
const END_OF_NOV_18_UTC = Date.UTC(2026, 10, 19);

describe("cache lifetime", () => {
  it("keeps entries through the end of 2026-11-18 (UTC)", () => {
    expect(CACHE_KEEP_UNTIL).toBe(END_OF_NOV_18_UTC);
  });

  it("covers judging for entries written during the build", () => {
    const writtenAt = Date.UTC(2026, 9, 15, 12);
    expect(
      writtenAt + cacheTtlSeconds(writtenAt) * 1000,
    ).toBeGreaterThanOrEqual(END_OF_NOV_18_UTC);
  });

  it("still reaches 2026-11-18 for an entry written on the last day of judging", () => {
    const writtenAt = Date.UTC(2026, 10, 17, 4, 45); // 06:45 in Bucharest
    expect(
      writtenAt + cacheTtlSeconds(writtenAt) * 1000,
    ).toBeGreaterThanOrEqual(END_OF_NOV_18_UTC);
  });

  it("never drops below 7 days", () => {
    expect(cacheTtlSeconds(Date.UTC(2026, 10, 18, 20))).toBe(7 * DAY);
    expect(cacheTtlSeconds(Date.UTC(2027, 0, 1))).toBe(7 * DAY);
  });
});

describe("Qloo client cache writes", () => {
  it("stores each response under a v2 key until at least 2026-11-18", async () => {
    const writes: { key: string; ttl: number }[] = [];
    const cache: QlooCache = {
      kind: "memory",
      get: async () => null,
      set: async (key, _value, ttl) => {
        writes.push({ key, ttl });
      },
    };
    const now = Date.UTC(2026, 9, 15, 12);
    const client = createQlooClient({
      apiKey: "test-key",
      cache,
      now: () => now,
      fetch: (async () =>
        new Response(JSON.stringify({ results: [] }))) as typeof fetch,
    });
    await client.search({ query: "Synthetic" });
    expect(writes).toHaveLength(1);
    expect(writes[0].key.startsWith("qloo:v2:/search?")).toBe(true);
    expect(now + writes[0].ttl * 1000).toBeGreaterThanOrEqual(
      END_OF_NOV_18_UTC,
    );
  });
});
