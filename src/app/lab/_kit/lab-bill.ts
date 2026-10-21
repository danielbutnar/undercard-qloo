import { cacheLife } from "next/cache";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { serverBuildStore } from "@/server/deps";
import { readLabBill } from "@/server/lab";

/** The saved Boise build, read like the home page reads it and cached for a minute. */
export async function labBill() {
  "use cache";
  cacheLife("minutes");
  return readLabBill(serverBuildStore(), SAGEBRUSH_SOUND.id);
}
