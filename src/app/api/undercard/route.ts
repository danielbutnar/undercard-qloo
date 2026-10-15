import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { AiNotConfigured, createAgentModel } from "@/server/ai";
import { createQlooClient } from "@/server/qloo";
import { createQlooCache } from "@/server/qloo-cache";
import { handleUndercardBuild } from "@/server/undercard-build";

// A build makes up to 12 Qloo calls and a few model turns.
export const maxDuration = 120;

export function POST(): Response {
  return handleUndercardBuild({
    festival: SAGEBRUSH_SOUND,
    qloo: () => {
      const apiKey = process.env.QLOO_API_KEY;
      if (!apiKey) return null;
      return createQlooClient({
        apiKey,
        cache: createQlooCache(),
        baseUrl: process.env.QLOO_BASE_URL || undefined,
      });
    },
    model: () => {
      try {
        return createAgentModel();
      } catch (error) {
        if (error instanceof AiNotConfigured) return null;
        throw error;
      }
    },
  });
}
