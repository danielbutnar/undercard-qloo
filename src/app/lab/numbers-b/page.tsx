import { cacheLife } from "next/cache";
import { FestivalScreen } from "@/components/festival-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { serverBuildStore } from "@/server/deps";
import { readFirstBill } from "@/server/first-bill";
import { townsOnShow } from "@/server/towns";

// M10a's variant (b) on the saved Boise build, the home page in every other way, for the lay
// readers' shots (docs/evidence.md section 27). Dev only, like all of /lab.
async function firstBill() {
  "use cache";
  cacheLife("minutes");
  return readFirstBill(serverBuildStore(), SAGEBRUSH_SOUND.id);
}

async function towns() {
  "use cache";
  cacheLife("minutes");
  return townsOnShow(serverBuildStore());
}

export default async function NumbersVariantB() {
  return (
    <FestivalScreen
      festival={SAGEBRUSH_SOUND}
      firstBill={await firstBill()}
      towns={await towns()}
      numbers="slot"
    />
  );
}
