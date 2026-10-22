import { noFanData } from "@/lib/fan-data";
import type { Festival } from "@/lib/festival";
import type { FirstBill } from "@/lib/first-bill";
import type { BuildStore } from "./build-store";
import { serverBuildStore } from "./deps";
import { createQlooClient, type QlooClient } from "./qloo";
import { createQlooCache } from "./qloo-cache";
import { assemblyFromSaved } from "./venue-switch";

/**
 * The venues Qloo had no fan data for in a saved build (WS2, src/lib/fan-data.ts), worked out
 * from the build and the Qloo cache only, never a Qloo call. A build the cache can't rebuild, or
 * another festival's, gives none.
 */
export async function noFanDataFor({
  store,
  festival,
  qloo,
  buildId,
}: {
  store: Pick<BuildStore, "byId">;
  festival: Festival;
  qloo: QlooClient;
  buildId: string;
}): Promise<string[]> {
  const saved = await store.byId(buildId);
  if (!saved || saved.festivalId !== festival.id) return [];
  const input = await assemblyFromSaved(saved, festival, qloo);
  return input ? noFanData(input) : [];
}

/** Reads cached Qloo answers and never calls Qloo; in synthetic mode, the seeded cache. */
function cacheReader(): QlooClient {
  return createQlooClient({
    apiKey: "",
    cache: createQlooCache(),
    cacheOnly: true,
  });
}

/**
 * The first bill with the venues Qloo had no fan data for, so How it works and Watch can say so;
 * left as it was when there are none or the cache can't tell.
 */
export async function withFanData(
  bill: FirstBill | null,
  festival: Festival,
  {
    store = serverBuildStore(),
    qloo = cacheReader(),
  }: { store?: Pick<BuildStore, "byId">; qloo?: QlooClient } = {},
): Promise<FirstBill | null> {
  if (!bill) return bill;
  const venues = await noFanDataFor({
    store,
    festival,
    qloo,
    buildId: bill.build.id,
  }).catch(() => []);
  return venues.length > 0 ? { ...bill, noFanData: venues } : bill;
}
