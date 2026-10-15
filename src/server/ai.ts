import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { LlmOnlyPickSchema, type LlmOnlyPick } from "@/lib/llm-only";

/**
 * The only module that calls an AI model (CLAUDE.md). SPEC.md section 7: RULES.md names no
 * models, so claude-sonnet-5-5 runs both the agent and the LLM-only baseline.
 */
export const AI_MODEL = "claude-sonnet-5-5";

export interface AgentTurnRequest {
  system: string;
  tools: Anthropic.Tool[];
  messages: Anthropic.MessageParam[];
}

/** One turn of the agent: the model answers with text, tool calls, or both. */
export interface AgentModel {
  nextTurn(request: AgentTurnRequest): Promise<Anthropic.Message>;
}

export class AiNotConfigured extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not set on the server.");
    this.name = "AiNotConfigured";
  }
}

export function createAgentModel(
  apiKey = process.env.ANTHROPIC_API_KEY,
): AgentModel {
  if (!apiKey) throw new AiNotConfigured();
  const client = new Anthropic({ apiKey, timeout: 60_000 });
  return {
    // Adaptive thinking is the model's default; medium effort suits multi-step tool use.
    // No refusal fallback: it would answer with a different model, which SPEC.md rules out.
    nextTurn: ({ system, tools, messages }) =>
      client.messages.create({
        model: AI_MODEL,
        max_tokens: 16000,
        system,
        tools,
        messages,
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
      }),
  };
}

const LLM_ONLY_SYSTEM = `You are a festival booking assistant with no data tools: answer from your own knowledge only. Suggest 10 artists for the festival's undercard, not the booked headliners. For each, give the artist's name and one sentence on why it fits.`;

const LlmOnlyAnswerSchema = z.object({ picks: z.array(LlmOnlyPickSchema) });

/** The LLM-only baseline's model: the festival brief in, the model's own picks out. */
export interface LlmOnlyModel {
  suggest(brief: string): Promise<LlmOnlyPick[]>;
}

export function createLlmOnlyModel({
  apiKey = process.env.ANTHROPIC_API_KEY,
  client,
}: { apiKey?: string; client?: Anthropic } = {}): LlmOnlyModel {
  if (!client && !apiKey) throw new AiNotConfigured();
  const anthropic = client ?? new Anthropic({ apiKey, timeout: 60_000 });
  return {
    async suggest(brief) {
      const response = await anthropic.messages.parse({
        model: AI_MODEL,
        max_tokens: 4000,
        system: LLM_ONLY_SYSTEM,
        messages: [{ role: "user", content: brief }],
        // A short list from memory: low effort is enough.
        output_config: { effort: "low", format: zodOutputFormat(LlmOnlyAnswerSchema) },
      });
      if (response.stop_reason === "refusal" || !response.parsed_output) {
        throw new Error("The model gave no usable answer.");
      }
      return response.parsed_output.picks;
    },
  };
}
