import { notFound } from "next/navigation";
import { labEnabled } from "@/lib/lab";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { labBill } from "../_kit/lab-bill";
import { DeskScreen } from "./desk-screen";

export default async function DeskPage() {
  if (!labEnabled()) notFound();
  return <DeskScreen festival={SAGEBRUSH_SOUND} bill={await labBill()} />;
}
