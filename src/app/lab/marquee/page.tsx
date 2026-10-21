import { notFound } from "next/navigation";
import { labEnabled } from "@/lib/lab";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { labBill } from "../_kit/lab-bill";
import { MarqueeScreen } from "./marquee-screen";

export default async function MarqueePage() {
  if (!labEnabled()) notFound();
  return <MarqueeScreen festival={SAGEBRUSH_SOUND} bill={await labBill()} />;
}
