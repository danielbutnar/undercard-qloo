import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { SHARE_SIZE } from "@/components/share/share-image";
import { shareAlt } from "@/components/share/share-words";
import { townBySlug } from "@/lib/towns";
import { serverBuildStore } from "@/server/deps";
import { shareCardFor, shareResponse } from "@/server/share-image";

// A town's link preview (WS10): the same brief's poster from the town's latest saved build, read
// on the server and cached for a minute like the town's page; never a Qloo call. A town with no
// saved build gets the plain card; a slug with no town page is not found, as the page is.
export const alt = shareAlt(null);
export const size = SHARE_SIZE;
export const contentType = "image/png";

async function card(slug: string) {
  "use cache";
  cacheLife("minutes");
  const town = townBySlug(slug);
  if (!town || slug === "boise") return null;
  return shareCardFor(serverBuildStore(), town.festival);
}

export default async function Image({
  params,
}: {
  params: Promise<{ town: string }>;
}) {
  const shown = await card((await params).town);
  if (!shown) notFound();
  return shareResponse(shown);
}
