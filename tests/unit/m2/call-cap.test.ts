import { describe, expect, it } from "vitest";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createToolbox, QLOO_CALL_CAP } from "@/server/agent-tools";
import { createMemoryCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { fakeFetch, syntheticQloo } from "./fake-qloo";

function setup() {
  const fake = fakeFetch(syntheticQloo);
  const toolbox = createToolbox({
    festival: SAGEBRUSH_SOUND,
    qloo: createQlooClient({
      apiKey: "test-key",
      cache: createMemoryCache(),
      fetch: fake.fetch,
    }),
    emit: () => {},
  });
  return { toolbox, requests: fake.requests };
}

// M2 set 12; Daniel's cap for Agent 2.0 is 28 a live run (WS13, 2026-10-24).
describe("the call cap", () => {
  it("is 28", () => {
    expect(QLOO_CALL_CAP).toBe(28);
  });

  it("lets 28 Qloo calls through and refuses the 29th without calling Qloo", async () => {
    const { toolbox, requests } = setup();
    for (let i = 0; i < QLOO_CALL_CAP; i++) {
      const result = await toolbox.run("search_artist", {
        name: `Synthetic Artist ${i}`,
      });
      expect(result.isError).toBe(false);
    }
    const over = await toolbox.run("search_artist", {
      name: "Synthetic Artist 29",
    });
    expect(over.isError).toBe(true);
    expect(over.content).toMatch(/28/);
    expect(requests).toHaveLength(28);
    expect(toolbox.callsUsed()).toBe(28);
  });

  it("holds when calls arrive in parallel", async () => {
    const { toolbox, requests } = setup();
    const results = await Promise.all(
      Array.from({ length: 31 }, (_, i) =>
        toolbox.run("search_artist", { name: `Parallel ${i}` }),
      ),
    );
    expect(results.filter((result) => result.isError)).toHaveLength(3);
    expect(requests).toHaveLength(28);
  });

  it("counts a call that was served from the cache", async () => {
    const { toolbox, requests } = setup();
    await toolbox.run("search_artist", { name: "Khruangbin" });
    await toolbox.run("search_artist", { name: "Khruangbin" });
    expect(requests).toHaveLength(1);
    expect(toolbox.callsUsed()).toBe(2);
  });

  it("doesn't count a tool that needs no Qloo call", async () => {
    const { toolbox } = setup();
    await toolbox.run("finish", { anchor_venue_ids: [], summary: "done" });
    expect(toolbox.callsUsed()).toBe(0);
  });
});
