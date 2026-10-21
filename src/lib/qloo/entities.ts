import { z } from "zod";
import type { QlooGet } from "./core";

// GET /entities: only each entity's image URL is read (item 4, artist images, off by default).
const EntitiesBody = z.object({
  results: z.array(
    z.object({
      entity_id: z.string(),
      properties: z
        .object({
          image: z.object({ url: z.string().optional() }).partial().nullish(),
        })
        .partial()
        .passthrough()
        .nullish(),
    }),
  ),
});

/** GET /entities: each act's image on Qloo, a whole lineup in one call. */
export function entitiesEndpoint(get: QlooGet) {
  /**
   * GET /entities: Qloo's image URL for each of a lineup's acts, in one call (item 4 of
   * the 2026-10-21 brief, used only while ARTIST_IMAGES is on).
   */
  return function images(entityIds: string[]) {
    return get("/entities", { entity_ids: entityIds.join(",") }, (body) =>
      EntitiesBody.parse(body).results.map((raw) => ({
        entityId: raw.entity_id,
        url: raw.properties?.image?.url ?? null,
      })),
    );
  };
}
