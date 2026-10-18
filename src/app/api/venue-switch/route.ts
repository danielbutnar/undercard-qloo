import { festivalById } from "@/lib/towns";
import { serverBuildStore, serverCachedQloo } from "@/server/deps";
import { syntheticMode } from "@/server/qloo-cache";
import { readVenueSwitch } from "@/server/venue-switch";

/**
 * GET /api/venue-switch?festival=<id>: every combination of the saved build's venues, with the
 * lineup the booking rule gives for each, worked out from the Qloo cache. It makes no Qloo or
 * model call and is never rate-limited.
 */
export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("festival") ?? undefined;
  const festival = festivalById(id);
  if (!festival)
    return Response.json(
      { error: "That festival isn't one of Undercard's." },
      { status: 400 },
    );
  if (syntheticMode()) {
    const { syntheticVenueSwitch } =
      await import("../../../../tests/e2e/synthetic-build");
    return Response.json(syntheticVenueSwitch());
  }
  const data = await readVenueSwitch({
    store: serverBuildStore(),
    festival,
    qloo: serverCachedQloo(),
  });
  if (!data)
    return Response.json(
      { error: "The venue switch isn't available for this build." },
      { status: 404 },
    );
  return Response.json(data, {
    headers: {
      "cache-control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  });
}
