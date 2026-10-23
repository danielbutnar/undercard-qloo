import { connection } from "next/server";
import {
  serverHealthModel,
  serverLimiter,
  serverUncachedQloo,
} from "@/server/deps";
import { handleDeepHealth } from "@/server/health";
import { clientIp } from "@/server/rate-limit";

// Qloo's retries may wait up to 45 s (QLOO_RETRY); the model call's tries are 20 s each.
export const maxDuration = 120;

/** The deep health check (src/server/health.ts), for the daily smoke workflow. */
export async function GET(request: Request): Promise<Response> {
  // Request time only: a build without HEALTH_TOKEN must never bake in a static 404.
  await connection();
  return handleDeepHealth({
    token: process.env.HEALTH_TOKEN,
    authorization: request.headers.get("authorization"),
    qloo: () => serverUncachedQloo(),
    model: serverHealthModel,
    limiter: serverLimiter(),
    ip: clientIp(request.headers),
  });
}
