import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { ShortlistScreen } from "@/components/shortlist/shortlist-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createQlooCache } from "@/server/qloo-cache";
import { shortlistExample } from "@/server/shortlist";

export const metadata: Metadata = {
  title: "Check a shortlist · Undercard",
  description:
    "Paste the acts you've been pitched; Undercard sorts them by how Qloo ranks them with a town's music-venue fans added to the headliners'. It drafts nothing and books nothing.",
};

// The buyer's shortlist (WS4). Boise's example, the model's own ten picks from its saved
// Without Qloo answer, is read on the server from the Qloo cache alone and briefly cached like
// the first screen; the page never calls Qloo or the model. A check runs only when the buyer
// presses the button (POST /api/shortlist).
async function example() {
  "use cache";
  cacheLife("minutes");
  return shortlistExample({
    festival: SAGEBRUSH_SOUND,
    cache: createQlooCache(),
  }).catch(() => null);
}

export default async function ShortlistPage() {
  return <ShortlistScreen example={await example()} />;
}
