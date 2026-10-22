// The deep health check's Qloo client (src/server/deps.ts): the usual client from src/lib/qloo
// with its usual retries, but it neither reads nor writes the server's Qloo cache, so every
// check asks Qloo itself. Fetch is stubbed; the answers are invented.
import { afterEach, describe, expect, it, vi } from "vitest";
import { serverUncachedQloo } from "@/server/deps";
import { QLOO_BASE_URL } from "@/server/qloo";
import { NO_CACHE } from "@/server/qloo-cache";
import { searchEntity } from "../m2/fake-qloo";

afterEach(() => vi.unstubAllGlobals());

const ENV = {
  QLOO_API_KEY: "test-key",
  // Set, so a client that used the shared cache would reach for this host.
  UPSTASH_REDIS_REST_URL: "https://cache.synthetic.invalid",
  UPSTASH_REDIS_REST_TOKEN: "synthetic-token",
};

describe("serverUncachedQloo", () => {
  it("asks Qloo every time and never reaches the server's cache", async () => {
    const reached: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      reached.push(`${url.origin}${url.pathname}`);
      return Response.json({
        results: [searchEntity(1, "Synthetic Headliner", 0.95)],
      });
    });
    const qloo = serverUncachedQloo(ENV);
    expect(qloo).not.toBeNull();
    await qloo!.search({ query: "Synthetic Headliner" });
    const { call } = await qloo!.search({ query: "Synthetic Headliner" });
    expect(call.cached).toBe(false);
    expect(reached).toEqual([
      `${QLOO_BASE_URL}/search`,
      `${QLOO_BASE_URL}/search`,
    ]);
  });

  it("keeps nothing: its cache never answers, even after a write", async () => {
    await NO_CACHE.set("qloo:v2:/search?query=Synthetic", [1], 60);
    expect(await NO_CACHE.get("qloo:v2:/search?query=Synthetic")).toBeNull();
  });

  it("is null without a Qloo key, and in synthetic mode", () => {
    expect(serverUncachedQloo({})).toBeNull();
    expect(
      serverUncachedQloo({ ...ENV, UNDERCARD_E2E_SYNTHETIC: "1" }),
    ).toBeNull();
  });
});
