// Evidence section 37 (docs/evidence.md): the control test across the 29 towns. For each checked
// town's saved build (its latest pointer's, read from the store with no write, and only if it is
// the one pinned in .design/pinned-builds/), each venue the build read is matched, in each tier
// it read it for, to the music room in the control town whose Qloo popularity is closest, and
// both are ranked on the run's day with the agent's own parameters; each tier's headliners-only
// ranking gives the drift. The logic is in src/server/control-test-37*.ts.
//
// The run's client keeps its own memory only: it reads nothing from the server's Qloo cache and
// writes nothing to it. Raw answers go to <main folder>/.design/evidence-37/ (git-ignored), with
// result.json and result.md (scripts/control-test-37-result.md, filled: counts only, for
// section 37); the console gets counts and town names only.
//
//   (default, or DRY=1)     calls nothing, writes nothing: the planned calls per town and in all.
//   LIVE=1 MAX_CALLS=<n>    at most n requests, one at a time, spaced SPACING_MS apart (1200 by
//                           default); stops at the first 429, rate-limit or quota answer, or any
//                           answer it can't use, writing what it has and saying where it stopped.
//   RESUME=1                with LIVE=1, carries on from .design/evidence-37/ without repeating a
//                           call (a completed run, resumed, makes no call and rewrites the results).
//
// It loads <main folder>/.env.local in place (or ENV_FILE), printing nothing from it. From the
// repository root or a worktree:
//   DRY=1 node --experimental-transform-types --disable-warning=ExperimentalWarning
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs
//     scripts/control-test-37.ts
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { fileRecord } from "@/server/control-test-37-client";
import { runControlTest37, settingsFrom } from "@/server/control-test-37-run";
import { createQlooCache } from "@/server/qloo-cache";

/** The main folder, where .design/ and .env.local live, also from a worktree. */
function mainFolder(): string {
  try {
    return dirname(
      execFileSync(
        "git",
        ["rev-parse", "--path-format=absolute", "--git-common-dir"],
        { encoding: "utf8" },
      ).trim(),
    );
  } catch {
    return process.cwd();
  }
}

const MAIN = mainFolder();
const envFile = process.env.ENV_FILE ?? join(MAIN, ".env.local");
if (!process.env.UPSTASH_REDIS_REST_URL && existsSync(envFile))
  process.loadEnvFile(envFile);
const settings = settingsFrom(process.env);
const OUT = process.env.EVIDENCE_37_DIR ?? join(MAIN, ".design", "evidence-37");
const PINNED =
  process.env.PINNED ??
  join(MAIN, ".design", "pinned-builds", "latest-pointers-2026-10-21.json");

const cache = createQlooCache();
if (cache.kind !== "upstash")
  throw new Error(
    "No Upstash settings: the saved builds are read from the store (ENV_FILE=<main folder>/.env.local).",
  );
const print = (line: unknown) => console.log(JSON.stringify(line));
print({ mode: settings.mode, out: OUT, pinned: PINNED });

const { code } = await runControlTest37({
  settings,
  serverCache: cache,
  pinned: JSON.parse(readFileSync(PINNED, "utf8")),
  towns: CHECKED_TOWNS,
  record: fileRecord(OUT),
  fetch: globalThis.fetch,
  apiKey: process.env.QLOO_API_KEY,
  log: print,
  write: (name, text) => {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, name), text);
  },
  template: readFileSync(
    new URL("./control-test-37-result.md", import.meta.url),
    "utf8",
  ),
});
process.exitCode = code;
