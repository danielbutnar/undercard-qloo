import { notFound } from "next/navigation";
import { labEnabled } from "@/lib/lab";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { labBill } from "../_kit/lab-bill";
import { FlapScreen } from "./flap-screen";

export default async function FlapPage() {
  if (!labEnabled()) notFound();
  return <FlapScreen festival={SAGEBRUSH_SOUND} bill={await labBill()} />;
}
