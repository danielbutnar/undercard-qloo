import { notFound } from "next/navigation";
import { labEnabled } from "@/lib/lab";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { labBill } from "../_kit/lab-bill";
import { BoardScreen } from "./board-screen";

export default async function BoardPage() {
  if (!labEnabled()) notFound();
  return <BoardScreen festival={SAGEBRUSH_SOUND} bill={await labBill()} />;
}
