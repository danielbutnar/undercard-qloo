import { z } from "zod";
import { festivalFromBody } from "@/lib/towns";
import {
  jsonBody,
  serverBuildStore,
  serverLimiter,
  serverModel,
  serverQloo,
} from "@/server/deps";
import { clientIp } from "@/server/rate-limit";
import { handleUndercardBuild, ndjsonResponse } from "@/server/undercard-build";

// A fresh build makes up to 12 Qloo calls and a few model turns.
export const maxDuration = 120;

const Body = z.object({ fresh: z.boolean().optional() });

export async function POST(request: Request): Promise<Response> {
  const raw = await jsonBody(request);
  const festival = festivalFromBody(raw);
  if (!festival)
    return ndjsonResponse(async (emit) => {
      emit({ type: "error", message: "That festival isn't one of Undercard's." });
      emit({ type: "done", calls: 0, ms: 0 });
    });
  const body = Body.safeParse(raw);
  return handleUndercardBuild({
    festival,
    qloo: serverQloo,
    model: serverModel,
    store: serverBuildStore(),
    fresh: body.success ? (body.data.fresh ?? false) : false,
    limiter: serverLimiter(),
    ip: clientIp(request.headers),
  });
}
