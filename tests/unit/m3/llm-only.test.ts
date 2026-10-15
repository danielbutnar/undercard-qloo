import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { LlmOnlyLineupSchema } from "@/lib/llm-only";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { AI_MODEL, createLlmOnlyModel, type LlmOnlyModel } from "@/server/ai";
import { handleLlmOnly } from "@/server/llm-only";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";

const picks = (names: string[]) =>
  names.map((name) => ({ name, note: `A synthetic note about ${name}.` }));
const TEN = picks(
  Array.from({ length: 10 }, (_, i) => `Synthetic Act ${i + 1}`),
);

function fakeModel(answer = TEN) {
  const suggest = vi.fn(async () => answer);
  return { model: { suggest } satisfies LlmOnlyModel, suggest };
}

async function json(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("POST /api/llm-only", () => {
  it("returns the model's 10 picks with no Qloo data", async () => {
    const { model } = fakeModel();
    const { status, body } = await json(
      await handleLlmOnly({
        festival: SAGEBRUSH_SOUND,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        model: () => model,
        cache: createMemoryCache(),
      }),
    );
    expect(status).toBe(200);
    const lineup = LlmOnlyLineupSchema.parse(body.lineup);
    expect(lineup.picks).toHaveLength(10);
    expect(lineup.festivalId).toBe("sagebrush-sound");
  });

  it("asks the model once and serves the saved answer after that", async () => {
    const { model, suggest } = fakeModel();
    const cache = createMemoryCache();
    await handleLlmOnly({
      festival: SAGEBRUSH_SOUND,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      model: () => model,
      cache,
    });
    const { body } = await json(
      await handleLlmOnly({
        festival: SAGEBRUSH_SOUND,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        model: () => model,
        cache,
      }),
    );
    expect(suggest).toHaveBeenCalledOnce();
    expect(body.cached).toBe(true);
  });

  it("drops a booked headliner the model repeats, and anything past 10", async () => {
    const { model } = fakeModel([
      ...picks(["Khruangbin", "japanese breakfast"]),
      ...TEN,
      ...picks(["Extra"]),
    ]);
    const { body } = await json(
      await handleLlmOnly({
        festival: SAGEBRUSH_SOUND,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        model: () => model,
        cache: createMemoryCache(),
      }),
    );
    const names = body.lineup.picks.map((pick: { name: string }) => pick.name);
    expect(names).toHaveLength(10);
    expect(names).not.toContain("Khruangbin");
    expect(names).not.toContain("japanese breakfast");
  });

  it("explains a missing model key", async () => {
    const { status, body } = await json(
      await handleLlmOnly({
        festival: SAGEBRUSH_SOUND,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        model: () => null,
        cache: createMemoryCache(),
      }),
    );
    expect(status).toBe(503);
    expect(body.error).toBe("The model isn't configured on this server.");
  });

  it("explains a model failure without caching it", async () => {
    const failing: LlmOnlyModel = {
      suggest: vi.fn(async () => Promise.reject(new Error("synthetic outage"))),
    };
    const cache = createMemoryCache();
    const { status, body } = await json(
      await handleLlmOnly({
        festival: SAGEBRUSH_SOUND,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        model: () => failing,
        cache,
      }),
    );
    expect(status).toBe(502);
    expect(body.error).toBe("The model didn't answer. Try again in a minute.");
    const { model, suggest } = fakeModel();
    await handleLlmOnly({
      festival: SAGEBRUSH_SOUND,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      model: () => model,
      cache,
    });
    expect(suggest).toHaveBeenCalledOnce();
  });
});

describe("createLlmOnlyModel (src/server/ai.ts)", () => {
  it(`asks ${AI_MODEL} for structured picks, with the same brief and no tools`, async () => {
    const parse = vi.fn(async () => ({
      stop_reason: "end_turn",
      parsed_output: { picks: TEN },
    }));
    const client = { messages: { parse } } as unknown as Anthropic;
    const model = createLlmOnlyModel({ client });
    expect(await model.suggest("Festival brief")).toEqual(TEN);
    const [request] = parse.mock.calls[0] as unknown as [
      Anthropic.MessageCreateParamsNonStreaming,
    ];
    expect(request.model).toBe("claude-sonnet-5-5");
    expect(request.messages).toEqual([
      { role: "user", content: "Festival brief" },
    ]);
    expect(request.tools).toBeUndefined();
    expect(request.output_config?.format).toBeDefined();
  });

  it("treats a refusal as a failure", async () => {
    const parse = vi.fn(async () => ({
      stop_reason: "refusal",
      parsed_output: null,
    }));
    const model = createLlmOnlyModel({
      client: { messages: { parse } } as unknown as Anthropic,
    });
    await expect(model.suggest("Festival brief")).rejects.toThrow();
  });
});
