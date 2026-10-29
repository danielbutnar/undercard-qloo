// Moves the checked towns' latest pointers to the re-run builds, with the 2.0 deploy and on Daniel's
// yes (2026-10-28 23:10). The logic is in src/server/pointer-move.ts: every pointer and target build
// is read with getOrThrow inside a time limit, and nothing is written unless every festival's move
// is clean (each pointer still holds the pinned record's build, and the target is stored for the
// same festival).
//
// DRY by default: prints each festival's plan and writes nothing. LIVE=1 writes the moves, reads
// every pointer again, and writes the new pinned record (OUT) for the after-window checks.
//   FROM=<pinned record>  default .design/pinned-builds/latest-pointers-2026-10-21.json
//   TO=<JSON list of { festivalId, buildId, createdAt }>  the builds the pointers move to
//   OUT=<new pinned record>  default .design/pinned-builds/latest-pointers-2026-10-29.json
// From a worktree, point --env-file, FROM, TO and OUT at the main folder's files:
//   node --env-file=<main folder>/.env.local --experimental-transform-types
//     --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON
//     --import ./scripts/register-ts.mjs scripts/move-pointers.ts
import { readFileSync, writeFileSync } from "node:fs";
import { applyMoves, planMoves } from "@/server/pointer-move";
import { createQlooCache } from "@/server/qloo-cache";

interface Pinned {
  festivals: { city?: string; festivalId: string; buildId: string }[];
}
interface Target {
  festivalId: string;
  buildId: string;
  createdAt?: string;
}

const FROM =
  process.env.FROM ?? ".design/pinned-builds/latest-pointers-2026-10-21.json";
const TO = process.env.TO;
const OUT =
  process.env.OUT ?? ".design/pinned-builds/latest-pointers-2026-10-29.json";
if (!TO) throw new Error("TO=<file> names the builds the pointers move to.");
const cache = createQlooCache();
if (cache.kind !== "upstash")
  throw new Error(
    "No Upstash settings: run with node --env-file=<main folder>/.env.local.",
  );

const pinned = (JSON.parse(readFileSync(FROM, "utf8")) as Pinned).festivals;
const targets = JSON.parse(readFileSync(TO, "utf8")) as Target[];
const was = new Map(pinned.map((entry) => [entry.festivalId, entry]));
if (targets.length !== pinned.length)
  throw new Error(
    `${targets.length} builds for ${pinned.length} pinned festivals: nothing planned.`,
  );
const moves = targets.map(({ festivalId, buildId }) => {
  const entry = was.get(festivalId);
  if (!entry)
    throw new Error(`${festivalId} isn't in ${FROM}: nothing planned.`);
  return { festivalId, from: entry.buildId, to: buildId };
});

const rows = await planMoves(cache, moves);
for (const row of rows)
  console.log(
    JSON.stringify({
      festival: row.festivalId,
      status: row.status,
      current: row.current,
      to: row.to,
    }),
  );
const counts = Object.fromEntries(
  ["move", "already", "mismatch", "missing", "unreadable"].map((status) => [
    status,
    rows.filter((row) => row.status === status).length,
  ]),
);
console.log(JSON.stringify({ plan: counts }));
if (process.env.LIVE !== "1") {
  console.log("DRY: nothing written.");
  process.exit(0);
}

const report = await applyMoves(cache, rows);
if (report.refused.length > 0) {
  console.log(
    JSON.stringify({
      written: 0,
      refused: report.refused.map((row) => [row.festivalId, row.status]),
    }),
  );
  process.exit(1);
}
const after = await planMoves(cache, moves);
writeFileSync(
  OUT,
  JSON.stringify(
    {
      readAt: new Date().toISOString(),
      how: "scripts/move-pointers.ts, read back from the store with getOrThrow after the move",
      pointerKey: "undercard:build:v1:latest:<festivalId>",
      festivals: targets.map(({ festivalId, buildId, createdAt }) => ({
        city: was.get(festivalId)?.city,
        festivalId,
        buildId,
        createdAt,
      })),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    written: report.written,
    allMoved: after.every((row) => row.status === "already"),
    out: OUT,
  }),
);
