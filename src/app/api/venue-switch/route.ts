import { festivalById } from "@/lib/towns";
import { venueSwitchFor } from "@/server/venue-switch";

/**
 * GET /api/venue-switch?festival=<id>: every combination of the saved build's venues, with the
 * lineup the booking rule gives for each, worked out from the Qloo cache. It makes no Qloo or
 * model call and is never rate-limited.
 */
export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const id = query.get("festival") ?? undefined;
  const buildId = query.get("build") ?? undefined;
  const festival = festivalById(id);
  if (!festival)
    return Response.json(
      { error: "That festival isn't one of Undercard's." },
      { status: 400 },
    );
  const data = await venueSwitchFor(festival, buildId);
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
