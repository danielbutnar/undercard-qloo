import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { AiNotConfigured, createLlmOnlyModel } from "@/server/ai";
import { serverLimiter } from "@/server/deps";
import { handleLlmOnly } from "@/server/llm-only";
import { createQlooCache } from "@/server/qloo-cache";
import { clientIp } from "@/server/rate-limit";

export const maxDuration = 60;

export function POST(request: Request): Promise<Response> {
  return handleLlmOnly({
    festival: SAGEBRUSH_SOUND,
    cache: createQlooCache(),
    limiter: serverLimiter(),
    ip: clientIp(request.headers),
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
