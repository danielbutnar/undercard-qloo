import { ImageResponse } from "next/og";
import { SHARE_SIZE, shareImage } from "@/components/share/share-image";
import { shareCard, type ShareCard } from "@/components/share/share-words";
import type { Festival } from "@/lib/festival";
import type { BuildStore } from "./build-store";
import { readFirstBill } from "./first-bill";

/**
 * The link preview's card for a festival (WS10): its latest saved build, read from the build store
 * the way the page reads it (readFirstBill, the same timeout), never from Qloo. No build, or a
 * store that fails or is slow, gives the plain card.
 */
export async function shareCardFor(
  store: Pick<BuildStore, "latest">,
  festival: Festival,
): Promise<ShareCard> {
  return shareCard(festival, await readFirstBill(store, festival.id));
}

/** The preview's PNG, 1200×630, in next/og's own font. */
export function shareResponse(card: ShareCard): Response {
  return new ImageResponse(shareImage(card), { ...SHARE_SIZE });
}
