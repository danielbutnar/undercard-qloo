import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { jsonBody, serverBuildStore, serverQloo } from "@/server/deps";
import { handleRefill } from "@/server/refill";

// A refill makes at most 3 Qloo calls.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return handleRefill({
    festival: SAGEBRUSH_SOUND,
    qloo: serverQloo,
    store: serverBuildStore(),
    body: await jsonBody(request),
  });
}
