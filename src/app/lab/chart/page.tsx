import { notFound } from "next/navigation";
import { labEnabled } from "@/lib/lab";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { labBill } from "../_kit/lab-bill";
import { ChartScreen } from "./chart-screen";

export default async function ChartPage() {
  if (!labEnabled()) notFound();
  return <ChartScreen festival={SAGEBRUSH_SOUND} bill={await labBill()} />;
}
