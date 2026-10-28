import { festivalFromBody } from "@/lib/towns";
import {
  jsonBody,
  serverBuildStore,
  serverCachedQloo,
  serverLimiter,
  serverQloo,
} from "@/server/deps";
import { clientIp } from "@/server/rate-limit";
import { handleRefill } from "@/server/refill";
import { ndjsonResponse } from "@/server/undercard-build";

// A refill makes at most 3 Qloo calls on a 1.0 build, 5 on a 2.0 build, none when the build's own
// rankings hold an act that passes the bar.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const body = await jsonBody(request);
  // The body names the festival whose saved build the refill reads; Boise when it doesn't.
  const festival = festivalFromBody(body);
  if (!festival)
    return ndjsonResponse(async (emit) => {
      emit({
        type: "error",
        message: "That festival isn't one of Undercard's.",
      });
      emit({ type: "done", calls: 0, ms: 0 });
    });
  return handleRefill({
    festival,
    qloo: serverQloo,
    cachedQloo: serverCachedQloo,
    store: serverBuildStore(),
    body,
    limiter: serverLimiter(),
    ip: clientIp(request.headers),
  });
}
