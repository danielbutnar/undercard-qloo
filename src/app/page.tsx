import { cacheLife } from "next/cache";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { withArtistImages } from "@/server/artist-images";
import { withSplits } from "@/server/attribution";
import { serverBuildStore } from "@/server/deps";
import { withFanData } from "@/server/fan-data";
import { readFirstBill } from "@/server/first-bill";
import { townsOnShow } from "@/server/towns";
import { withVenueSwitch } from "@/server/venue-switch";

// The latest saved build, read on the server and cached for a minute, so the page is served
// as static HTML with the bill on first paint. A festival's first saved build shows up within
// that minute; a later live run never replaces it.
async function firstBill() {
  "use cache";
  cacheLife("minutes");
  // Qloo's artist images join only while ARTIST_IMAGES is on (src/lib/artist-images.ts).
  // The venue switch comes with it, so the first paint shows the venue results (plan.md item 4),
  // and the venues Qloo had no fan data for, from the cache, for Watch (WS2), and each act's
  // card line on Qloo's split, from the cache too (WS7).
  return withSplits(
    await withFanData(
      await withVenueSwitch(
        await withArtistImages(
          await readFirstBill(serverBuildStore(), SAGEBRUSH_SOUND.id),
        ),
        SAGEBRUSH_SOUND,
      ),
      SAGEBRUSH_SOUND,
    ),
    SAGEBRUSH_SOUND,
  );
}

// The towns with a saved build of the same brief, for the switcher; cached the same way.
async function towns() {
  "use cache";
  cacheLife("minutes");
  return townsOnShow(serverBuildStore());
}

export default async function Home() {
  return (
    <FestivalScreen
      festival={SAGEBRUSH_SOUND}
      firstBill={await firstBill()}
      towns={await towns()}
    />
  );
}
