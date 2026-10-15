import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import {
  jsonBody,
  serverBuildStore,
  serverLimiter,
  serverQloo,
} from "@/server/deps";
import { clientIp } from "@/server/rate-limit";
import { handleRefill } from "@/server/refill";

// A refill makes at most 3 Qloo calls.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return handleRefill({
    festival: SAGEBRUSH_SOUND,
    qloo: serverQloo,
    store: serverBuildStore(),
    body: await jsonBody(request),
    limiter: serverLimiter(),
    ip: clientIp(request.headers),
  });
}
