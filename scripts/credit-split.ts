// WS13 item 10: credit and split. Counts, by town and tier, the saved cards whose credited venue
// isn't Qloo's largest venue share (evidence 35 counted 44 of 290), from the store and the Qloo
// cache only: it reads each festival's latest saved build (stopping unless every one is the
// pinned build) and each build's split as the act cards read it. No Qloo call, no model call,
// nothing written to the store or the cache (a write throws). Prints counts only; the cards'
// names go to OUT under .design/ (git-ignored). From a worktree:
//   OUT=<main folder>/.design/ws13/credit-split.json \
//   PINNED=<main folder>/.design/pinned-builds/latest-pointers-2026-10-21.json \
//   node --env-file=<main folder>/.env.local --experimental-transform-types
//     --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON
//     --import ./scripts/register-ts.mjs scripts/credit-split.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { checkedFestival } from "@/lib/towns";
import { pinnedBuilds, readOnlyCache } from "@/server/attribution-warm";
import { createBuildStore } from "@/server/build-store";
import { creditReport } from "@/server/credit-split";
import { createQlooCache } from "@/server/qloo-cache";

const cache = createQlooCache();
if (cache.kind !== "upstash")
  throw new Error(
    "No Upstash settings: run with node --env-file=<main folder>/.env.local.",
  );
const readOnly = readOnlyCache(cache);
const PINNED =
  process.env.PINNED ?? ".design/pinned-builds/latest-pointers-2026-10-21.json";
const OUT = process.env.OUT ?? ".design/ws13/credit-split.json";

const towns = new Map(
  CHECKED_TOWNS.map((town) => [checkedFestival(town).id, town.city]),
);
const builds = await pinnedBuilds({
  store: createBuildStore(readOnly),
  festivalIds: [...towns.keys()],
  pinned: JSON.parse(readFileSync(PINNED, "utf8")),
});
const { counts, cards } = await creditReport(
  builds,
  readOnly,
  (festivalId) => towns.get(festivalId) ?? festivalId,
);

console.log(JSON.stringify({ builds: builds.length, total: counts.total }));
console.log(JSON.stringify({ byTier: counts.byTier }));
for (const [town, tally] of Object.entries(counts.byTown))
  if (tally.disagree > 0) console.log(JSON.stringify({ town, ...tally }));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ counts, cards }, null, 1));
console.log(`Cards with names: ${OUT}`);
