import { festivalFromBody } from "@/lib/towns";
import {
  jsonBody,
  serverBuildStore,
  serverLimiter,
  serverCachedQloo,
  serverQloo,
} from "@/server/deps";
import { clientIp } from "@/server/rate-limit";
import { handleRedraft } from "@/server/redraft";
import { ndjsonResponse } from "@/server/undercard-build";

// A redraft makes at most 3 Qloo calls on a 1.0 build, 5 on a 2.0 build, none for the slots the
// build's own rankings fill.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const body = await jsonBody(request);
  // The body names the festival whose saved build the redraft reads; Boise when it doesn't.
  const festival = festivalFromBody(body);
  if (!festival)
    return ndjsonResponse(async (emit) => {
      emit({
        type: "error",
        message: "That festival isn't one of Undercard's.",
      });
      emit({ type: "done", calls: 0, ms: 0 });
    });
  return handleRedraft({
    festival,
    qloo: serverQloo,
    cachedQloo: serverCachedQloo,
    store: serverBuildStore(),
    body,
    limiter: serverLimiter(),
    ip: clientIp(request.headers),
  });
}
