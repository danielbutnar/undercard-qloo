// Judging-window resilience (plan.md item 2, prompt A part 1): the live-build caps come from
// LIVE_BUILDS_PER_IP_PER_DAY and LIVE_BUILDS_GLOBAL_PER_DAY, read where the limiter is built on
// each request, with today's 5 and 60 as defaults; replays have no cap.
import { describe, expect, it } from "vitest";
import { createMemoryLimiter, LIMITS, limitsFrom } from "@/server/rate-limit";

const at = Date.UTC(2026, 10, 3, 12);
const allowedIn = async (
  limiter: ReturnType<typeof createMemoryLimiter>,
  calls: { ip: string }[],
) => {
  const verdicts = [];
  for (const { ip } of calls) verdicts.push(await limiter.check("build", ip));
  return verdicts;
};

describe("the live-build caps from the environment", () => {
  it("keeps 5 per IP and 60 for everyone when neither is set", () => {
    const limits = limitsFrom({});
    expect(limits.build.perIp).toBe(5);
    expect(limits.build.perDay).toBe(60);
    expect(limits.refill).toEqual(LIMITS.refill);
  });

  it("allows exactly the per-IP number a day from one IP, then says so", async () => {
    const limiter = createMemoryLimiter({
      limits: limitsFrom({ LIVE_BUILDS_PER_IP_PER_DAY: "8" }),
      now: () => at,
    });
    const verdicts = await allowedIn(
      limiter,
      Array.from({ length: 9 }, () => ({ ip: "203.0.113.7" })),
    );
    expect(verdicts.slice(0, 8).every((v) => v.allowed)).toBe(true);
    expect(verdicts[8]).toMatchObject({
      allowed: false,
      message: expect.stringContaining(
        "today's 8 fresh builds from this network",
      ),
    });
  });

  it("allows exactly the global number a day across IPs, then says so", async () => {
    const limiter = createMemoryLimiter({
      limits: limitsFrom({ LIVE_BUILDS_GLOBAL_PER_DAY: "3" }),
      now: () => at,
    });
    const verdicts = await allowedIn(
      limiter,
      ["198.51.100.1", "198.51.100.2", "198.51.100.3", "198.51.100.4"].map(
        (ip) => ({ ip }),
      ),
    );
    expect(verdicts.slice(0, 3).every((v) => v.allowed)).toBe(true);
    expect(verdicts[3]).toMatchObject({
      allowed: false,
      message: expect.stringContaining(
        "today's limit of 3 fresh builds for everyone",
      ),
    });
  });

  it("falls back to the default for a missing or malformed value", () => {
    for (const bad of ["", "abc", "0", "-5", "5.5", "1e3", " 7 x"]) {
      const limits = limitsFrom({
        LIVE_BUILDS_PER_IP_PER_DAY: bad,
        LIVE_BUILDS_GLOBAL_PER_DAY: bad,
      });
      expect(limits.build.perIp).toBe(5);
      expect(limits.build.perDay).toBe(60);
    }
    expect(limitsFrom({ LIVE_BUILDS_PER_IP_PER_DAY: " 12 " }).build.perIp).toBe(
      12,
    );
  });
});
