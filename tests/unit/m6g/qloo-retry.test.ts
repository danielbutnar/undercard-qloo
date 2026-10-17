import { describe, expect, it } from "vitest";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient, QlooBusy, QLOO_RETRY } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";
import type { BuildEvent } from "@/lib/build-events";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents, scriptedPlanner } from "../m3/scripted";

const busy = (status: number, retryAfter?: string) =>
  new Response(JSON.stringify({ error: "busy" }), {
    status,
    headers: retryAfter ? { "retry-after": retryAfter } : {},
  });

/** A clock and a sleep that advance together, so backoff runs instantly in tests. */
function fakeTime() {
  let now = 0;
  const slept: number[] = [];
  return {
    now: () => now,
    sleep: async (ms: number) => {
      slept.push(ms);
      now += ms;
    },
    slept,
  };
}

function client(
  route: (url: URL) => unknown,
  overrides: Partial<typeof QLOO_RETRY> = {},
) {
  const time = fakeTime();
  const fake = fakeFetch(route);
  const qloo = createQlooClient({
    apiKey: "k",
    cache: createMemoryCache(),
    fetch: fake.fetch,
    retry: { ...QLOO_RETRY, ...overrides },
    sleep: time.sleep,
    clock: time.now,
    random: () => 0.5,
  });
  return { qloo, time, requests: fake.requests };
}

describe("the Qloo client under a rate limit", () => {
  it("retries a 429 and a 503 and returns the answer, recording the retries on the call", async () => {
    const answers = [busy(429), busy(503)];
    const { qloo, requests } = client(
      (url) => answers.shift() ?? syntheticQloo(url),
    );
    const { data, call } = await qloo.search({ query: "Khruangbin" });
    expect(data.length).toBeGreaterThan(0);
    expect(call.retried).toEqual([429, 503]);
    expect(requests).toHaveLength(3);
  });

  it("waits at least as long as Retry-After asks", async () => {
    const answers = [busy(429, "3")];
    const { qloo, time } = client(
      (url) => answers.shift() ?? syntheticQloo(url),
    );
    await qloo.search({ query: "Khruangbin" });
    expect(time.slept[0]).toBeGreaterThanOrEqual(3000);
  });

  it("backs off exponentially, with jitter, up to a ceiling", async () => {
    const answers = [busy(503), busy(503), busy(503)];
    const { qloo, time } = client(
      (url) => answers.shift() ?? syntheticQloo(url),
      {
        baseDelayMs: 400,
        maxDelayMs: 1000,
      },
    );
    await qloo.search({ query: "Khruangbin" });
    // Full jitter at random 0.5: half of 400, 800, then the 1000 ceiling.
    expect(time.slept).toEqual([200, 400, 500]);
  });

  it("doesn't retry a 400: that answer won't change", async () => {
    const { qloo, requests } = client(() => busy(400));
    await expect(qloo.search({ query: "x" })).rejects.toThrow(/HTTP 400/);
    expect(requests).toHaveLength(1);
  });

  it("gives up with QlooBusy when the build's time budget would run out", async () => {
    const { qloo, time } = client(() => busy(429), { budgetMs: 5000 });
    await expect(qloo.search({ query: "x" })).rejects.toBeInstanceOf(QlooBusy);
    expect(time.slept.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(5000);
  });

  it("keeps no more calls in flight than the cap", async () => {
    let inFlight = 0;
    let most = 0;
    const fake = fakeFetch(syntheticQloo);
    const qloo = createQlooClient({
      apiKey: "k",
      cache: createMemoryCache(),
      retry: { ...QLOO_RETRY, maxInFlight: 2 },
      fetch: async (input, init) => {
        inFlight++;
        most = Math.max(most, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return fake.fetch(input, init);
      },
    });
    await Promise.all(
      ["a", "b", "c", "d", "e"].map((query) => qloo.search({ query })),
    );
    expect(most).toBe(2);
  });
});

describe("a build under a rate limit", () => {
  async function build(route: (url: URL) => unknown) {
    const time = fakeTime();
    const cache = createMemoryCache();
    const fake = fakeFetch(route);
    const qloo = createQlooClient({
      apiKey: "k",
      cache,
      fetch: fake.fetch,
      sleep: time.sleep,
      clock: time.now,
      random: () => 0.5,
    });
    const planner = scriptedPlanner();
    const events: BuildEvent[] = await readEvents(
      await handleUndercardBuild({
        festival: SAGEBRUSH_SOUND,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => qloo,
        model: () => planner.model,
        store: createBuildStore(cache),
        fresh: true,
      }),
    );
    const calls = events.flatMap((event) =>
      event.type === "call" ? [event.call] : [],
    );
    const lineup = events.find((event) => event.type === "lineup");
    return { events, calls, lineup, requests: fake.requests, time };
  }

  it("tests the same rooms and books the same bill as without the 429s and 503s, within the 12 calls", async () => {
    const clean = await build(syntheticQloo);
    // Every URL fails once, alternating 429 and 503, then answers.
    const seen = new Set<string>();
    let flip = false;
    const flaky = await build((url) => {
      const key = url.toString();
      if (!seen.has(key)) {
        seen.add(key);
        flip = !flip;
        return busy(flip ? 429 : 503);
      }
      return syntheticQloo(url);
    });

    const summaries = (calls: typeof clean.calls) =>
      calls.map((call) => call.summary).sort();
    expect(summaries(flaky.calls)).toEqual(summaries(clean.calls));
    expect(flaky.lineup).toEqual(clean.lineup);
    expect(flaky.calls.length).toBe(clean.calls.length);
    expect(flaky.calls.length).toBeLessThanOrEqual(12);
    expect(flaky.calls.every((call) => (call.retried ?? []).length === 1)).toBe(
      true,
    );
    expect(flaky.events.some((event) => event.type === "error")).toBe(false);
  });

  it("ends in a Qloo-is-busy error when the time budget runs out, still within the 12 calls", async () => {
    const result = await build((url) =>
      url.pathname === "/v2/insights" ? busy(429) : syntheticQloo(url),
    );
    const error = result.events.find(
      (event) => event.type === "error" && event.code === "qloo-busy",
    );
    expect(error).toBeTruthy();
    expect(result.calls.length).toBeLessThanOrEqual(12);
    expect(result.time.now()).toBeLessThanOrEqual(QLOO_RETRY.budgetMs);
  });
});
