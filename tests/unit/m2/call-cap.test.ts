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

describe("the 12-call cap", () => {
  it("is 12", () => {
    expect(QLOO_CALL_CAP).toBe(12);
  });

  it("lets 12 Qloo calls through and refuses the 13th without calling Qloo", async () => {
    const { toolbox, requests } = setup();
    for (let i = 0; i < QLOO_CALL_CAP; i++) {
      const result = await toolbox.run("search_artist", {
        name: `Synthetic Artist ${i}`,
      });
      expect(result.isError).toBe(false);
    }
    const thirteenth = await toolbox.run("search_artist", {
      name: "Synthetic Artist 13",
    });
    expect(thirteenth.isError).toBe(true);
    expect(thirteenth.content).toMatch(/12/);
    expect(requests).toHaveLength(12);
    expect(toolbox.callsUsed()).toBe(12);
  });

  it("holds when calls arrive in parallel", async () => {
    const { toolbox, requests } = setup();
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        toolbox.run("search_artist", { name: `Parallel ${i}` }),
      ),
    );
    expect(results.filter((result) => result.isError)).toHaveLength(3);
    expect(requests).toHaveLength(12);
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
