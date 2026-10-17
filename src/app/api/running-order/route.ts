import { festivalFromBody } from "@/lib/towns";
import {
  jsonBody,
  serverBuildStore,
  serverLimiter,
  serverQloo,
} from "@/server/deps";
import { clientIp } from "@/server/rate-limit";
import { handleRunningOrder } from "@/server/running-order";
import { ndjsonResponse } from "@/server/undercard-build";

// A running order makes at most 10 Qloo calls (M8a).
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const body = await jsonBody(request);
  // The body names the festival whose saved build the running order reads; Boise when it doesn't.
  const festival = festivalFromBody(body);
  if (!festival)
    return ndjsonResponse(async (emit) => {
      emit({
        type: "error",
        message: "That festival isn't one of Undercard's.",
      });
      emit({ type: "done", calls: 0, ms: 0 });
    });
  return handleRunningOrder({
    festival,
    qloo: serverQloo,
    store: serverBuildStore(),
    body,
    limiter: serverLimiter(),
    ip: clientIp(request.headers),
  });
}
