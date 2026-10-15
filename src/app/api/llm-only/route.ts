import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { AiNotConfigured, createLlmOnlyModel } from "@/server/ai";
import { handleLlmOnly } from "@/server/llm-only";
import { createQlooCache } from "@/server/qloo-cache";

export const maxDuration = 60;

export function POST(): Promise<Response> {
  return handleLlmOnly({
    festival: SAGEBRUSH_SOUND,
    cache: createQlooCache(),
    model: () => {
      try {
        return createLlmOnlyModel();
      } catch (error) {
        if (error instanceof AiNotConfigured) return null;
        throw error;
      }
    },
  });
}
