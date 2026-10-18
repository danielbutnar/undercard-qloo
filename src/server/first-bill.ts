import type { FeeBandId } from "@/lib/fee-bands";
import type { FirstBill } from "@/lib/first-bill";
import { billPlaces } from "@/lib/places";
import type { BuildStore, SavedBuild } from "./build-store";

export type { FirstBill };

function toFirstBill(saved: SavedBuild): FirstBill {
  const venueSearch = saved.trace.find((call) => call.tool === "find_venues");
  const baselineTop: Partial<Record<FeeBandId, number>> = {};
  for (const [band, ids] of Object.entries(saved.context.baselines)) {
    if (ids) baselineTop[band as FeeBandId] = ids.length;
  }
  return {
    build: { id: saved.id, createdAt: saved.createdAt },
    acts: saved.lineup.acts,
    calls: saved.trace.length,
    placesListed: venueSearch?.resultCount ?? null,
    anchors: saved.context.anchors,
    baselineTop,
    places: billPlaces(saved.lineup.acts, saved.context.baselines),
  };
}

/**
 * The festival's latest saved build for the first screen, or null when none is saved, the
 * store fails or it doesn't answer in time: the page then falls back to the empty board.
 */
export async function readFirstBill(
  store: Pick<BuildStore, "latest">,
  festivalId: string,
  { timeoutMs = 2000 }: { timeoutMs?: number } = {},
): Promise<FirstBill | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const saved = await Promise.race([store.latest(festivalId), timeout]);
    return saved ? toFirstBill(saved) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
