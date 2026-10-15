// Opt-in check of the Upstash-backed limiter against a real Upstash database:
//   LIVE_UPSTASH=1 pnpm vitest run tests/unit/m4/rate-limit-upstash.test.ts
// It reads UPSTASH_REDIS_REST_URL and _TOKEN from .env.local and uses its own key prefix,
// so it never touches the app's counters. Skipped otherwise.
import { existsSync } from "node:fs";
import { Redis } from "@upstash/redis";
import { describe, expect, it } from "vitest";
import { createUpstashLimiter, LIMITS } from "@/server/rate-limit";

const live = Boolean(process.env.LIVE_UPSTASH);
if (live && existsSync(".env.local")) process.loadEnvFile(".env.local");

describe.skipIf(!live)("Upstash limiter (live)", () => {
  it("counts per IP and for everyone in daily windows", async () => {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const limits = {
      ...LIMITS,
      refill: { ...LIMITS.refill, perIp: 2, perDay: 3 },
    };
    const limiter = createUpstashLimiter(
      redis,
      limits,
      `undercard:rl-test:${Date.now()}`,
    );
    expect(limiter.kind).toBe("upstash");

    expect((await limiter.check("refill", "203.0.113.1")).allowed).toBe(true);
    expect((await limiter.check("refill", "203.0.113.1")).allowed).toBe(true);
    const ownLimit = await limiter.check("refill", "203.0.113.1");
    expect(ownLimit).toMatchObject({ allowed: false });

    expect((await limiter.check("refill", "203.0.113.2")).allowed).toBe(true);
    const everyone = await limiter.check("refill", "203.0.113.3");
    expect(everyone).toMatchObject({ allowed: false });
    if (!everyone.allowed) expect(everyone.message).toContain("for everyone");
  }, 30_000);
});
