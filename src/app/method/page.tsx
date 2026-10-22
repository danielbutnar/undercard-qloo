import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { MethodPage } from "@/components/method-page";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { withArtistImages } from "@/server/artist-images";
import { serverBuildStore } from "@/server/deps";
import { withFanData } from "@/server/fan-data";
import { readFirstBill } from "@/server/first-bill";

export const metadata: Metadata = { title: "How Undercard works" };

// How it works (M10b) follows one act through the saved Boise build, read on the server and
// cached for a minute like the first screen, so every number on the page is the build's.
async function story() {
  "use cache";
  cacheLife("minutes");
  return methodStory(
    SAGEBRUSH_SOUND,
    // The same images as the first screen, from the same cached Qloo call, and the venues Qloo
    // had no fan data for, from the cache (WS2).
    await withFanData(
      await withArtistImages(
        await readFirstBill(serverBuildStore(), SAGEBRUSH_SOUND.id),
      ),
      SAGEBRUSH_SOUND,
    ),
  );
}

export default async function Method() {
  return <MethodPage story={await story()} />;
}
