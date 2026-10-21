import {
  ARTIST_IMAGES,
  isQlooImage,
  type ArtistImages,
} from "@/lib/artist-images";
import type { FirstBill } from "@/lib/first-bill";
import { serverQloo } from "./deps";
import type { QlooClient } from "./qloo";

type QlooImages = Pick<QlooClient, "images">;

/**
 * A whole lineup's image URLs in one Qloo call (GET /entities), cached server-side like every
 * Qloo answer; null when there's no client or Qloo fails, so the acts keep their drawn covers.
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

/** The saved build with its acts' images, only while ARTIST_IMAGES is on; as it is otherwise. */
export async function withArtistImages(
  bill: FirstBill | null,
  qloo?: QlooImages | null,
  on: boolean = ARTIST_IMAGES,
): Promise<FirstBill | null> {
  if (!on || !bill) return bill;
  const images = await readArtistImages(
    qloo === undefined ? serverQloo() : qloo,
    bill.acts.map((act) => act.entityId),
  );
  return images ? { ...bill, images } : bill;
}
