import {
  ARTIST_IMAGES,
  isQlooImage,
  type ArtistImages,
} from "@/lib/artist-images";
import type { FirstBill } from "@/lib/first-bill";
import { serverCachedQloo } from "./deps";
import type { QlooClient } from "./qloo";

type QlooImages = Pick<QlooClient, "images">;

/**
 * A whole lineup's image URLs in one Qloo call (GET /entities), cached server-side like every
 * Qloo answer; null when there's no client or Qloo fails (a cache-only client's miss is a
 * failure too), so the acts keep their drawn covers.
 */
export async function readArtistImages(
  qloo: QlooImages | null,
  entityIds: readonly string[],
): Promise<ArtistImages | null> {
  if (!qloo || entityIds.length === 0) return null;
  try {
    const { data } = await qloo.images([...entityIds]);
    const wanted = new Map(entityIds.map((id) => [id.toUpperCase(), id]));
    const images: Record<string, string> = {};
    for (const { entityId, url } of data) {
      const id = wanted.get(entityId.toUpperCase());
      if (id && url && isQlooImage(url)) images[id] = url;
    }
    return images;
  } catch {
    return null;
  }
}

/**
 * A saved build's photos (WS9): its lineup's, in the lineup's order, then its headliners', in
 * the build's order, one /entities call each. The page reads them with a cache-only client;
 * scripts/warm-page-images.ts calls this same function with a live one, so the cache keys match.
 */
export async function billImages(
  bill: Pick<FirstBill, "acts" | "headliners">,
  qloo: QlooImages | null,
): Promise<Pick<FirstBill, "images" | "headlinerImages">> {
  const [images, headlinerImages] = await Promise.all([
    readArtistImages(
      qloo,
      bill.acts.map((act) => act.entityId),
    ),
    readArtistImages(
      qloo,
      (bill.headliners ?? []).map((headliner) => headliner.entityId),
    ),
  ]);
  return {
    ...(images ? { images } : {}),
    ...(headlinerImages && Object.keys(headlinerImages).length > 0
      ? { headlinerImages }
      : {}),
  };
}

/**
 * The saved build with its photos, only while ARTIST_IMAGES is on; as it is otherwise. A page
 * reads them from the Qloo cache only (serverCachedQloo), so a render never calls Qloo: a photo
 * the cache doesn't hold leaves its act with the drawn cover.
 */
export async function withArtistImages(
  bill: FirstBill | null,
  qloo?: QlooImages | null,
  on: boolean = ARTIST_IMAGES,
): Promise<FirstBill | null> {
  if (!on || !bill) return bill;
  const read = await billImages(
    bill,
    qloo === undefined ? serverCachedQloo() : qloo,
  );
  return Object.keys(read).length > 0 ? { ...bill, ...read } : bill;
}
