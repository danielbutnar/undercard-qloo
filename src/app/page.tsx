import { cacheLife } from "next/cache";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { serverBuildStore } from "@/server/deps";
import { readFirstBill } from "@/server/first-bill";
import { townsOnShow } from "@/server/towns";

// The latest saved build, read on the server and cached for a minute, so the page is served
// as static HTML with the bill on first paint. A fresh build shows up within that minute.
async function firstBill() {
  "use cache";
  cacheLife("minutes");
  return readFirstBill(serverBuildStore(), SAGEBRUSH_SOUND.id);
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
