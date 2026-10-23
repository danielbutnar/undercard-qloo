// The deep health check's one model call (src/server/ai.ts): the smallest prompt, one token
// back, nothing from the answer kept. The Anthropic client is a stub; no call leaves the test.
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AiNotConfigured, createHealthModel } from "@/server/ai";

function stubClient(answer: () => Promise<unknown>) {
  const create = vi.fn(answer);
  const client = { messages: { create } } as unknown as Anthropic;
  return { client, create };
}

describe("createHealthModel (src/server/ai.ts)", () => {
  it("asks claude-sonnet-5-5 once, with a one-character prompt and max_tokens 1, and returns nothing", async () => {
    const { client, create } = stubClient(async () => ({
      stop_reason: "max_tokens",
      content: [{ type: "text", text: "A synthetic answer" }],
    }));
    expect(await createHealthModel({ client }).ping()).toBeUndefined();
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]).toEqual([
      {
        model: "claude-sonnet-5-5",
        max_tokens: 1,
        messages: [{ role: "user", content: "." }],
      },
    ]);
  });

  it("fails when the API answers with an error", async () => {
    const { client } = stubClient(async () => {
      throw new Error("synthetic overload");
    });
    await expect(createHealthModel({ client }).ping()).rejects.toThrow();
  });

  it("fails when the model declines", async () => {
    const { client } = stubClient(async () => ({
      stop_reason: "refusal",
      content: [],
    }));
    await expect(createHealthModel({ client }).ping()).rejects.toThrow();
  });

  it("needs ANTHROPIC_API_KEY when no client is given", () => {
    expect(() => createHealthModel({ apiKey: "" })).toThrow(AiNotConfigured);
  });
});
