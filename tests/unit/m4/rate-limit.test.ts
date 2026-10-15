import { describe, expect, it, vi } from "vitest";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import type { LlmOnlyModel } from "@/server/ai";
import { createBuildStore } from "@/server/build-store";
import { handleLlmOnly } from "@/server/llm-only";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import {
  clientIp,
  createMemoryLimiter,
  LIMITS,
  type RateLimiter,
} from "@/server/rate-limit";
import { handleRefill } from "@/server/refill";
import { handleUndercardBuild } from "@/server/undercard-build";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents, scriptedPlanner } from "../m3/scripted";

const DAY = 24 * 60 * 60 * 1000;
const denyAll: RateLimiter = {
  kind: "memory",
  check: async () => ({
    allowed: false,
    message: "Synthetic limit.",
    retryAfterSeconds: 60,
  }),
};

describe("memory limiter", () => {
  it("allows each IP its daily allowance, then explains the limit", async () => {
    const limiter = createMemoryLimiter({
      now: () => Date.UTC(2026, 9, 20, 12),
    });
    for (let i = 0; i < LIMITS.build.perIp; i++) {
      expect((await limiter.check("build", "203.0.113.7")).allowed).toBe(true);
    }
    const over = await limiter.check("build", "203.0.113.7");
    expect(over).toMatchObject({ allowed: false });
    if (over.allowed) return;
    expect(over.message).toBe(
      `You've used today's ${LIMITS.build.perIp} fresh builds from this network. The saved build still replays instantly. Try again tomorrow (UTC).`,
    );
    expect(over.retryAfterSeconds).toBe(12 * 60 * 60);
    expect((await limiter.check("build", "203.0.113.8")).allowed).toBe(true);
  });

  it("starts a new allowance on the next UTC day", async () => {
    let now = Date.UTC(2026, 9, 20, 23, 59);
    const limiter = createMemoryLimiter({ now: () => now });
    for (let i = 0; i < LIMITS.refill.perIp; i++)
      await limiter.check("refill", "203.0.113.7");
    expect((await limiter.check("refill", "203.0.113.7")).allowed).toBe(false);
    now += 2 * 60 * 1000;
    expect((await limiter.check("refill", "203.0.113.7")).allowed).toBe(true);
  });

  it("caps everyone together with a daily ceiling", async () => {
    const limiter = createMemoryLimiter({
      now: () => Date.UTC(2026, 9, 20),
      limits: {
        ...LIMITS,
        llmOnly: { ...LIMITS.llmOnly, perIp: 5, perDay: 3 },
      },
    });
    for (const ip of ["198.51.100.1", "198.51.100.2", "198.51.100.3"]) {
      expect((await limiter.check("llmOnly", ip)).allowed).toBe(true);
    }
    const over = await limiter.check("llmOnly", "198.51.100.4");
    expect(over).toMatchObject({
      allowed: false,
      message:
        "Undercard has reached today's limit of 3 LLM-only requests for everyone. Try again tomorrow (UTC).",
    });
  });

  it("keeps the actions' allowances apart", async () => {
    const limiter = createMemoryLimiter({ now: () => Date.UTC(2026, 9, 20) });
    for (let i = 0; i < LIMITS.build.perIp; i++)
      await limiter.check("build", "203.0.113.7");
    expect((await limiter.check("refill", "203.0.113.7")).allowed).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip, then the first x-forwarded-for address", () => {
    expect(
      clientIp(
        new Headers({
          "x-real-ip": "203.0.113.7",
          "x-forwarded-for": "198.51.100.1",
        }),
      ),
    ).toBe("203.0.113.7");
    expect(
      clientIp(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" })),
    ).toBe("198.51.100.1");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

function buildServer(limiter: RateLimiter) {
  const cache = createMemoryCache();
  const store = createBuildStore(cache);
  const fake = fakeFetch(syntheticQloo);
  const qloo = createQlooClient({
    apiKey: "test-key",
    cache,
    fetch: fake.fetch,
  });
  const planner = scriptedPlanner();
  const build = (fresh = false, withLimiter = limiter) =>
    handleUndercardBuild({
      festival: SAGEBRUSH_SOUND,
      qloo: () => qloo,
      model: () => planner.model,
      store,
      fresh,
      replayDelayMs: 0,
      limiter: withLimiter,
      ip: "203.0.113.7",
    });
  return { store, qloo, fake, planner, build };
}

describe("rate limits on the routes", () => {
  it("stops a fresh build at the limit with a friendly 429, before the agent runs", async () => {
    const server = buildServer(denyAll);
    const response = await server.build(true);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    const events = await readEvents(response);
    expect(events).toEqual([
      { type: "error", message: "Synthetic limit." },
      { type: "done", calls: 0, ms: 0 },
    ]);
    expect(server.planner.turns()).toBe(0);
    expect(server.fake.requests).toHaveLength(0);
  });

  it("never limits replaying the saved build", async () => {
    const server = buildServer(createMemoryLimiter());
    await readEvents(server.build(true));
    const replay = await server.build(false, denyAll);
    expect(replay.status).toBe(200);
    expect((await readEvents(replay))[0]).toMatchObject({
      type: "build",
      replayed: true,
    });
  });

  it(`allows ${LIMITS.build.perIp} fresh builds per IP per day`, async () => {
    const server = buildServer(
      createMemoryLimiter({ now: () => Date.UTC(2026, 9, 20) }),
    );
    for (let i = 0; i < LIMITS.build.perIp; i++) {
      expect((await server.build(true)).status).toBe(200);
    }
    expect((await server.build(true)).status).toBe(429);
  });

  it("stops a refill at the limit without calling Qloo", async () => {
    const server = buildServer(createMemoryLimiter());
    await readEvents(server.build(true));
    const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
    const before = server.fake.requests.length;
    const gone = saved.lineup.acts[0];
    const response = await handleRefill({
      festival: SAGEBRUSH_SOUND,
      qloo: () => server.qloo,
      store: server.store,
      body: {
        buildId: saved.id,
        unavailableId: gone.entityId,
        band: gone.band,
        anchorVenueId: null,
        excludeIds: [],
      },
      limiter: denyAll,
      ip: "203.0.113.7",
    });
    expect(response.status).toBe(429);
    expect((await readEvents(response))[0]).toEqual({
      type: "error",
      message: "Synthetic limit.",
    });
    expect(server.fake.requests).toHaveLength(before);
  });

  it("limits the LLM-only call to the model, not the saved answer", async () => {
    const suggest = vi.fn(async () => [
      { name: "Synthetic Act", note: "A synthetic note." },
    ]);
    const model: LlmOnlyModel = { suggest };
    const cache = createMemoryCache();
    const call = (limiter: RateLimiter) =>
      handleLlmOnly({
        festival: SAGEBRUSH_SOUND,
        model: () => model,
        cache,
        limiter,
        ip: "203.0.113.7",
      });

    const limited = await call(denyAll);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "Synthetic limit." });
    expect(suggest).not.toHaveBeenCalled();

    expect((await call(createMemoryLimiter())).status).toBe(200);
    const saved = await call(denyAll);
    expect(saved.status).toBe(200);
    expect((await saved.json()).cached).toBe(true);
    expect(suggest).toHaveBeenCalledOnce();
  });

  it("keeps day boundaries in UTC", () => {
    expect(DAY).toBe(86_400_000);
  });
});
