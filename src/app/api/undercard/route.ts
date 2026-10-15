import { z } from "zod";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import {
  jsonBody,
  serverBuildStore,
  serverLimiter,
  serverModel,
  serverQloo,
} from "@/server/deps";
import { clientIp } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";

// A fresh build makes up to 12 Qloo calls and a few model turns.
export const maxDuration = 120;

const Body = z.object({ fresh: z.boolean().optional() });

export async function POST(request: Request): Promise<Response> {
  const body = Body.safeParse(await jsonBody(request));
  return handleUndercardBuild({
    festival: SAGEBRUSH_SOUND,
    qloo: serverQloo,
    model: serverModel,
    store: serverBuildStore(),
    fresh: body.success ? (body.data.fresh ?? false) : false,
    limiter: serverLimiter(),
    ip: clientIp(request.headers),
  });
}
