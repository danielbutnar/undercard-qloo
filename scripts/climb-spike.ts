// M9a spike (docs/evidence.md section 19): can a replay rebuild each saved build's climb from
// the Qloo cache alone? Reads the production store and cache, never calls Qloo (a cache-only
// client whose fetch throws), and prints counts only. From the repository root:
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/climb-spike.ts
import { existsSync } from "node:fs";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { checkedFestival } from "@/lib/towns";
import { createBuildStore } from "@/server/build-store";
import { createQlooCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { replayClimbs } from "@/server/undercard-build";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const cache = createQlooCache();
const store = createBuildStore(cache);
let fetches = 0;
const qloo = createQlooClient({
  apiKey: "",
  cache,
  cacheOnly: true,
  fetch: async () => {
    fetches++;
    throw new Error("the spike must not call Qloo");
  },
});
const rows = [];
for (const town of CHECKED_TOWNS) {
  const festival = checkedFestival(town);
  const saved = await store.latest(festival.id);
  if (!saved) {
    rows.push({ town: festival.id, saved: false });
    continue;
  }
  const expected = saved.trace.filter(
    (call) => call.tool === "baseline_artists" || call.tool === "venue_artists",
  ).length;
  const climbs = await replayClimbs(saved, festival, qloo);
  rows.push({ town: festival.id, expected, rebuilt: climbs.size, full: climbs.size === expected });
}
for (const row of rows) console.log(JSON.stringify(row));
console.log(
  JSON.stringify({
    fetches,
    towns: rows.length,
    full: rows.filter((row) => "full" in row && row.full).length,
  }),
);
