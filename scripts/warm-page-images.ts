// The first screen's photos (WS9): the page reads each town's lineup and headliner images from
// the Qloo cache only (src/server/artist-images.ts), so a photo the cache doesn't hold shows the
// drawn cover rather than calling Qloo during a render. This script checks, for each town on
// show, whether the cache holds both, and with LIVE=1 makes the missing /entities calls through
// billImages, the function the page reads with, so the cache keys are the page's own.
//
// Dry by default: a cache-only client whose fetch throws, reading the store and the cache only.
// LIVE=1 calls Qloo for what's missing, at most MAX_CALLS calls (default 1: the four towns share
// the same two headliners, so one call covers them all). Prints counts and festival ids only.
// From the repository root (ENV_FILE points at another checkout's .env.local, e.g. from a worktree):
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/warm-page-images.ts
import { existsSync } from "node:fs";
import { TOWNS } from "@/lib/towns";
import { billImages } from "@/server/artist-images";
import { createBuildStore } from "@/server/build-store";
import { readFirstBill } from "@/server/first-bill";
import { createQlooCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);
const LIVE = process.env.LIVE === "1";
const MAX_CALLS = Number(process.env.MAX_CALLS ?? 1);
const cache = createQlooCache();
if (cache.kind !== "upstash") throw new Error("no Upstash settings found");
const store = createBuildStore(cache);

let calls = 0;
// How many different headliner pairs the towns' builds found: one pair is one /entities call.
const headlinerSets = new Set<string>();
const cachedOnly = createQlooClient({
  apiKey: "",
  cache,
  cacheOnly: true,
  fetch: async () => {
    throw new Error("the check must not call Qloo");
  },
});
const live = LIVE
  ? createQlooClient({
      apiKey: process.env.QLOO_API_KEY ?? "",
      cache,
      fetch: async (input, init) => {
        if (calls >= MAX_CALLS)
          throw new Error(`MAX_CALLS=${MAX_CALLS} reached; nothing more sent`);
        calls++;
        return fetch(input, init);
      },
    })
  : null;

for (const town of TOWNS) {
  const bill = await readFirstBill(store, town.festival.id, {
    timeoutMs: 10_000,
  });
  if (!bill) {
    console.log(JSON.stringify({ festival: town.festival.id, saved: false }));
    continue;
  }
  headlinerSets.add(
    (bill.headliners ?? []).map((headliner) => headliner.entityId).join(","),
  );
  const before = await billImages(bill, cachedOnly);
  const row: Record<string, unknown> = {
    festival: town.festival.id,
    build: bill.build.id,
    acts: bill.acts.length,
    actImagesCached: Object.keys(before.images ?? {}).length,
    headliners: bill.headliners?.length ?? 0,
    headlinerImagesCached: Object.keys(before.headlinerImages ?? {}).length,
  };
  const missing =
    before.images === undefined || before.headlinerImages === undefined;
  if (live && missing) {
    const after = await billImages(bill, live);
    row.actImagesAfter = Object.keys(after.images ?? {}).length;
    row.headlinerImagesAfter = Object.keys(after.headlinerImages ?? {}).length;
  }
  console.log(JSON.stringify(row));
}
console.log(
  JSON.stringify({
    live: LIVE,
    qlooCalls: calls,
    headlinerPairs: headlinerSets.size,
  }),
);
