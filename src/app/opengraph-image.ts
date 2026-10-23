import { cacheLife } from "next/cache";
import { SHARE_SIZE } from "@/components/share/share-image";
import { shareAlt } from "@/components/share/share-words";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { serverBuildStore } from "@/server/deps";
import { shareCardFor, shareResponse } from "@/server/share-image";

// The home page's link preview (WS10): Sagebrush Sound's poster from Boise's latest saved build,
// read on the server and cached for a minute like the page's bill; never a Qloo call.
export const alt = shareAlt(SAGEBRUSH_SOUND);
export const size = SHARE_SIZE;
export const contentType = "image/png";

async function card() {
  "use cache";
  cacheLife("minutes");
  return shareCardFor(serverBuildStore(), SAGEBRUSH_SOUND);
}

export default async function Image() {
  return shareResponse(await card());
}
