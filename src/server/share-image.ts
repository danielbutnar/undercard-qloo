import { ImageResponse } from "next/og";
import { PRINT_SIZE, printImage } from "@/components/share/print-image";
import type { PrintPoster } from "@/components/share/print-words";
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

/**
 * The printable poster's PNG (WS12 item 6), 1800×2400, as a download under its file name. It
 * is drawn from the poster it's given alone, so it is never cached.
 */
export function printResponse(poster: PrintPoster): Response {
  return new ImageResponse(printImage(poster), {
    ...PRINT_SIZE,
    headers: {
      "content-disposition": `attachment; filename="${poster.file}"`,
      "cache-control": "no-store",
    },
  });
}
