import { z } from "zod";
import { festivalFromBody } from "@/lib/towns";
import { YourBriefSchema, yourFestival } from "@/lib/your-festival";
import {
  jsonBody,
  serverBuildStore,
  serverLimiter,
  serverCachedQloo,
  serverAgentQloo,
  serverModel,
} from "@/server/deps";
import { clientIp } from "@/server/rate-limit";
import { handleUndercardBuild, ndjsonResponse } from "@/server/undercard-build";

// A fresh build makes up to 28 Qloo calls (Agent 2.0's cap) and up to 16 model turns.
export const maxDuration = 120;

const Body = z.object({
  fresh: z.boolean().optional(),
  replayOnly: z.boolean().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const raw = await jsonBody(request);
  // A judge's own brief (M6f): its own festival id, a live run, never saved.
  if (raw && typeof raw === "object" && "brief" in raw) {
    const brief = YourBriefSchema.safeParse((raw as { brief: unknown }).brief);
    if (!brief.success)
      return ndjsonResponse(async (emit) => {
        emit({ type: "error", message: "That brief needs a town and two different headliners." });
        emit({ type: "done", calls: 0, ms: 0 });
      });
    return handleUndercardBuild({
      festival: yourFestival(brief.data, `yours-${crypto.randomUUID().slice(0, 8)}`),
      qloo: serverAgentQloo,
      model: serverModel,
      store: serverBuildStore(),
      fresh: true,
      save: false,
      limiter: serverLimiter(),
      ip: clientIp(request.headers),
    });
  }
  const festival = festivalFromBody(raw);
  if (!festival)
    return ndjsonResponse(async (emit) => {
      emit({ type: "error", message: "That festival isn't one of Undercard's." });
      emit({ type: "done", calls: 0, ms: 0 });
    });
  const body = Body.safeParse(raw);
  return handleUndercardBuild({
    festival,
    qloo: serverAgentQloo,
    model: serverModel,
    store: serverBuildStore(),
    fresh: body.success ? (body.data.fresh ?? false) : false,
    replayOnly: body.success ? (body.data.replayOnly ?? false) : false,
    cachedQloo: serverCachedQloo,
    limiter: serverLimiter(),
    ip: clientIp(request.headers),
  });
}
