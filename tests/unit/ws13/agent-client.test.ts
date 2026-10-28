// WS13: the agent's live runs read and write Agent 2.0's own cache prefix, never the one the
// saved 1.0 builds read; refills and the rest keep theirs.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serverAgentQloo, serverQloo } from "@/server/deps";
import { AGENT_CACHE_PREFIX, QLOO_CACHE_PREFIX } from "@/server/qloo";

afterEach(() => vi.unstubAllEnvs());

describe("serverAgentQloo (WS13)", () => {
  it("is the server's Qloo client over Agent 2.0's prefix", () => {
    vi.stubEnv("QLOO_API_KEY", "test-key");
    expect(serverAgentQloo()?.cachePrefix).toBe(AGENT_CACHE_PREFIX);
    expect(serverQloo()?.cachePrefix).toBe(QLOO_CACHE_PREFIX);
  });

  it("is null where the server's client is (no key, or synthetic mode)", () => {
    vi.stubEnv("QLOO_API_KEY", "");
    expect(serverAgentQloo()).toBeNull();
    vi.stubEnv("QLOO_API_KEY", "test-key");
    vi.stubEnv("UNDERCARD_E2E_SYNTHETIC", "1");
    expect(serverAgentQloo()).toBeNull();
  });

  it("is the client POST /api/undercard runs the agent with, for a town and for a judge's own brief", () => {
    const route = readFileSync(
      new URL("../../../src/app/api/undercard/route.ts", import.meta.url),
      "utf8",
    );
    expect(route.match(/qloo: serverAgentQloo,/g)).toHaveLength(2);
    expect(route).not.toMatch(/qloo: serverQloo,/);
  });
});
