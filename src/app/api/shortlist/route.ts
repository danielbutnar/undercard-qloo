import { jsonBody, serverBuildStore, serverLimiter } from "@/server/deps";
import { clientIp } from "@/server/rate-limit";
import { handleShortlist, serverShortlistClients } from "@/server/shortlist";

// A buyer's shortlist check (WS4) makes at most 14 Qloo calls and no model call.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return handleShortlist({
    body: await jsonBody(request),
    store: serverBuildStore(),
    clients: serverShortlistClients,
    limiter: serverLimiter(),
    ip: clientIp(request.headers),
  });
}
