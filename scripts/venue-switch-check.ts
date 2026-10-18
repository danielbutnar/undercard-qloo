// The venue switch's one-off check (final design round, 2026-10-18): with every venue on, does
// the booking rule rerun on each saved build's own Qloo results give back the saved lineup, act
// for act? Reads the production store and the Qloo cache, never calls Qloo (a cache-only client
// whose fetch throws), never saves, and prints counts and festival ids only. From the
// repository root (ENV_FILE points at another checkout's .env.local, e.g. from a worktree):
//   node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/venue-switch-check.ts
import { existsSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { checkedFestival } from "@/lib/towns";
import { lineupWith, venuesOf } from "@/lib/venue-switch";
import { createBuildStore } from "@/server/build-store";
import { createQlooCache } from "@/server/qloo-cache";
import { createQlooClient } from "@/server/qloo";
import { assemblyFromSaved } from "@/server/venue-switch";

const envFile = process.env.ENV_FILE ?? ".env.local";
if (existsSync(envFile)) process.loadEnvFile(envFile);
const cache = createQlooCache();
if (cache.kind !== "upstash") throw new Error("no Upstash settings found");
const store = createBuildStore(cache);
let fetches = 0;
const qloo = createQlooClient({
  apiKey: "",
  cache,
  cacheOnly: true,
  fetch: async () => {
    fetches++;
    throw new Error("the check must not call Qloo");
  },
});

// M6l's label isn't kept in a build's context, so it is compared from the saved act's own venue.
const withoutKind = <T extends { anchorVenue: { kind?: string } }>(act: T) => ({
  ...act,
  anchorVenue: { ...act.anchorVenue, kind: undefined },
});

const rows = [];
for (const town of CHECKED_TOWNS) {
  const festival = checkedFestival(town);
  const saved = await store.latest(festival.id);
  if (!saved) {
    rows.push({ festival: festival.id, saved: false });
    continue;
  }
  const input = await assemblyFromSaved(saved, festival, qloo);
  if (!input) {
    rows.push({ festival: festival.id, rebuilt: false });
    continue;
  }
  const venues = venuesOf(input);
  const all = lineupWith(input, new Set(venues.map((venue) => venue.entityId)));
  const same = isDeepStrictEqual(all.acts, saved.lineup.acts);
  const sameIgnoringKind = isDeepStrictEqual(
    all.acts.map(withoutKind),
    saved.lineup.acts.map(withoutKind),
  );
  const offs = venues.map((venue) => {
    const on = new Set(
      venues.map((v) => v.entityId).filter((id) => id !== venue.entityId),
    );
    const lineup = lineupWith(input, on);
    return lineup.acts.length;
  });
  rows.push({
    festival: festival.id,
    venues: venues.length,
    acts: saved.lineup.acts.length,
    equal: same,
    equalIgnoringKind: sameIgnoringKind,
    actsWithEachVenueOff: offs,
  });
}
for (const row of rows) console.log(JSON.stringify(row));
console.log(
  JSON.stringify({
    fetches,
    builds: rows.length,
    equal: rows.filter((row) => "equal" in row && row.equal).length,
  }),
);
