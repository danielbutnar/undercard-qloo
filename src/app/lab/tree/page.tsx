import { notFound } from "next/navigation";
import { labEnabled } from "@/lib/lab";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { labBill } from "../_kit/lab-bill";
import { TreeScreen } from "./tree-screen";

export default async function TreePage() {
  if (!labEnabled()) notFound();
  return <TreeScreen festival={SAGEBRUSH_SOUND} bill={await labBill()} />;
}
