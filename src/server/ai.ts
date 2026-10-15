import Anthropic from "@anthropic-ai/sdk";

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
