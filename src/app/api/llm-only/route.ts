import { festivalFromBody } from "@/lib/towns";
import { AiNotConfigured, createLlmOnlyModel } from "@/server/ai";
import { jsonBody, serverLimiter } from "@/server/deps";
import { handleLlmOnly } from "@/server/llm-only";
import { savedPickChecks } from "@/server/pick-checks";
import { createQlooCache } from "@/server/qloo-cache";
import { clientIp } from "@/server/rate-limit";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  // The body names the festival whose brief the model answers; Boise when it doesn't.
  const festival = festivalFromBody(await jsonBody(request));
  if (!festival)
    return Response.json(
      { error: "That festival isn't one of Undercard's." },
      { status: 400 },
    );
  return handleLlmOnly({
    festival,
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
    // Each pick's checks for its card, from the Qloo cache alone: no Qloo call, no model.
    checks: (lineup) => savedPickChecks(festival, lineup),
  });
}
