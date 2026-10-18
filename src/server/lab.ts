import { labPlaces, type LabBill } from "@/lib/lab";
import type { BuildStore } from "./build-store";
import { readFirstBill } from "./first-bill";

/**
 * The festival's latest saved build for the lab, or null when none is saved or the store doesn't
 * answer in time. It only reads: no Qloo or Claude call, and the latest pointer never moves.
 */
export async function readLabBill(
  store: Pick<BuildStore, "latest">,
  festivalId: string,
  { timeoutMs = 5000 }: { timeoutMs?: number } = {},
): Promise<LabBill | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const saved = await Promise.race([store.latest(festivalId), timeout]);
    if (!saved) return null;
    const first = await readFirstBill(
      { latest: async () => saved },
      festivalId,
    );
    if (!first) return null;
    return {
      first,
      places: labPlaces(saved.lineup.acts, saved.context.baselines),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
