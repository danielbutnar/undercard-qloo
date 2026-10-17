import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createLlmOnlyModel } from "@/server/ai";
import { handleLlmOnly } from "@/server/llm-only";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";

const TEN = Array.from({ length: 10 }, (_, i) => ({
  name: `Synthetic Act ${i + 1}`,
  note: `A synthetic note ${i + 1}.`,
}));

describe("a fair baseline", () => {
  it("asks the model alone at high effort, with as many tokens as the agent's planner gets", async () => {
    const parse = vi.fn(async () => ({
      stop_reason: "end_turn",
      parsed_output: { picks: TEN },
    }));
    const model = createLlmOnlyModel({
      client: { messages: { parse } } as unknown as Anthropic,
    });
    await model.suggest("Festival brief");
    const [request] = parse.mock.calls[0] as unknown as [
      Anthropic.MessageCreateParamsNonStreaming,
    ];
    expect(request.output_config?.effort).toBe("high");
    expect(request.max_tokens).toBe(16000);
  });

  it("asks again rather than serve an answer saved at the old effort", async () => {
    const cache = createMemoryCache();
    await cache.set(
      "undercard:llm-only:v1:sagebrush-sound",
      {
        festivalId: "sagebrush-sound",
        createdAt: "2026-10-15T10:30:00.000Z",
        picks: TEN.slice(0, 3),
      },
      3600,
    );
    const suggest = vi.fn(async () => TEN);
    const response = await handleLlmOnly({
      festival: SAGEBRUSH_SOUND,
      cache,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      model: () => ({ suggest }),
    });
    const body = await response.json();
    expect(suggest).toHaveBeenCalledOnce();
    expect(body.cached).toBe(false);
    expect(body.lineup.picks).toHaveLength(10);
  });
});
