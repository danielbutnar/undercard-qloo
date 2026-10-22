// GET /api/health/deep (src/server/health.ts), with both services stubbed: Qloo through the
// real client from src/lib/qloo on a stubbed fetch (its retries run on a fake clock), and the
// model as a stub ping. No call leaves the test; the Qloo answers are invented.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthModel } from "@/server/ai";
import { serverUncachedQloo } from "@/server/deps";
import { handleDeepHealth, HEALTH_QUERY } from "@/server/health";
import { QLOO_BASE_URL, QLOO_RETRY } from "@/server/qloo";
import { createMemoryLimiter, type RateLimiter } from "@/server/rate-limit";
import { fakeFetch, searchEntity } from "../m2/fake-qloo";

const TOKEN = "synthetic-health-token-4f1c9a";
const NOON = Date.UTC(2026, 9, 22, 12);
const IP = "203.0.113.7";

const found = () =>
  Response.json({ results: [searchEntity(1, "Synthetic Headliner", 0.95)] });
const answered = (status: number) =>
  new Response(JSON.stringify({ error: "synthetic" }), { status });

function setup({
  qloo = found,
  ping = async () => {},
  limiter = createMemoryLimiter({ now: () => NOON }),
  configured = true,
}: {
  qloo?: () => Response;
  ping?: HealthModel["ping"];
  limiter?: RateLimiter;
  configured?: boolean;
} = {}) {
  // A clock and a sleep that advance together, so Qloo's backoff runs instantly.
  let now = NOON;
  const clock = () => now;
  const sleep = async (ms: number) => {
    now += ms;
  };
  const fake = fakeFetch(() => qloo());
  const model = { ping: vi.fn(ping) };
  // An explicit `token: undefined` stands for an unset HEALTH_TOKEN.
  const check = (
    authorization: string | null,
    options: { token?: string; ip?: string } = {},
  ) =>
    handleDeepHealth({
      token: "token" in options ? options.token : TOKEN,
      authorization,
      qloo: () =>
        serverUncachedQloo(configured ? { QLOO_API_KEY: "test-key" } : {}, {
          fetch: fake.fetch,
          sleep,
          clock,
          random: () => 0.5,
        }),
      model: () => (configured ? model : null),
      limiter,
      ip: options.ip ?? IP,
      clock,
    });
  return { check, requests: fake.requests, ping: model.ping };
}

const bearer = `Bearer ${TOKEN}`;

// Nothing from either answer is logged: no test here may write to the console.
let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map(
    (level) => vi.spyOn(console, level).mockImplementation(() => {}),
  );
});
afterEach(() => {
  for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe("GET /api/health/deep", () => {
  it("answers 404 while HEALTH_TOKEN is unset or blank, and calls nothing", async () => {
    const { check, requests, ping } = setup();
    for (const token of [undefined, "", "   "]) {
      const response = await check(bearer, { token });
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(requests).toHaveLength(0);
    expect(ping).not.toHaveBeenCalled();
  });

  it("token missing: 401, and calls nothing", async () => {
    const { check, requests, ping } = setup();
    const response = await check(null);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect(await response.json()).toEqual({ error: "Unauthorized." });
    expect(requests).toHaveLength(0);
    expect(ping).not.toHaveBeenCalled();
  });

  it("token wrong: 401, calls nothing and doesn't use up the day's checks", async () => {
    const { check, requests, ping } = setup();
    for (const header of [
      "Bearer not-the-token",
      `Bearer ${TOKEN.toUpperCase()}`,
      `Bearer ${TOKEN}x`,
      `Basic ${TOKEN}`,
      TOKEN,
      "Bearer",
    ])
      expect((await check(header)).status).toBe(401);
    expect(requests).toHaveLength(0);
    expect(ping).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) expect((await check(bearer)).status).toBe(200);
  });

  it("both fine: one uncached Qloo search for the fixed query, one model ping, and only ok, ok and the time", async () => {
    const { check, requests, ping } = setup();
    const response = await check(bearer);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    const body = JSON.parse(text);
    expect(Object.keys(body).sort()).toEqual(["anthropic", "ms", "qloo"]);
    expect(body).toMatchObject({ qloo: "ok", anthropic: "ok" });
    expect(body.ms).toBeGreaterThanOrEqual(0);
    expect(text).not.toContain("Synthetic Headliner");

    expect(requests).toHaveLength(1);
    const [{ url, init }] = requests;
    expect(`${url.origin}${url.pathname}`).toBe(`${QLOO_BASE_URL}/search`);
    expect(url.searchParams.get("query")).toBe(HEALTH_QUERY);
    expect(init?.method).toBe("GET");
    expect(ping).toHaveBeenCalledOnce();

    // The next check asks Qloo again: nothing was read from or kept in a cache.
    await check(bearer);
    expect(requests).toHaveLength(2);
  });

  it("Qloo 401: qloo fails at once, with no retry, and the model is still checked", async () => {
    const { check, requests, ping } = setup({ qloo: () => answered(401) });
    expect(await (await check(bearer)).json()).toMatchObject({
      qloo: "fail",
      anthropic: "ok",
    });
    expect(requests).toHaveLength(1);
    expect(ping).toHaveBeenCalledOnce();
  });

  it("Qloo 429 after retries: qloo fails once the usual retry budget is spent", async () => {
    const { check, requests } = setup({ qloo: () => answered(429) });
    expect(await (await check(bearer)).json()).toMatchObject({
      qloo: "fail",
      anthropic: "ok",
    });
    expect(requests).toHaveLength(QLOO_RETRY.maxRetries + 1);
  });

  it("Qloo answers but finds nothing: qloo fails", async () => {
    const { check } = setup({ qloo: () => Response.json({ results: [] }) });
    expect(await (await check(bearer)).json()).toMatchObject({
      qloo: "fail",
      anthropic: "ok",
    });
  });

  it("Anthropic error: anthropic fails, and Qloo is still checked", async () => {
    const { check, requests } = setup({
      ping: async () => {
        throw new Error("synthetic overload");
      },
    });
    expect(await (await check(bearer)).json()).toMatchObject({
      qloo: "ok",
      anthropic: "fail",
    });
    expect(requests).toHaveLength(1);
  });

  it("a server without the Qloo or model key: both fail, with no call", async () => {
    const { check, requests } = setup({ configured: false });
    expect(await (await check(bearer)).json()).toMatchObject({
      qloo: "fail",
      anthropic: "fail",
    });
    expect(requests).toHaveLength(0);
  });

  it("the limit: 3 checks per IP and 3 in all per UTC day, then the friendly message, with no call", async () => {
    const { check, requests, ping } = setup();
    for (let i = 0; i < 3; i++) expect((await check(bearer)).status).toBe(200);

    const own = await check(bearer);
    expect(own.status).toBe(429);
    expect(own.headers.get("retry-after")).toBe(String(12 * 60 * 60));
    expect(await own.json()).toEqual({
      error:
        "You've used today's 3 deep health checks from this network. Try again tomorrow (UTC).",
    });

    const everyone = await check(bearer, { ip: "203.0.113.8" });
    expect(everyone.status).toBe(429);
    expect(await everyone.json()).toEqual({
      error:
        "Undercard has reached today's limit of 3 deep health checks for everyone. Try again tomorrow (UTC).",
    });
    expect(requests).toHaveLength(3);
    expect(ping).toHaveBeenCalledTimes(3);
  });
});
