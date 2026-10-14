#!/usr/bin/env node
// Claude Code Stop hook: a run may only end while the project's `gate` script passes.
//
// Silent skips (exit 0):
//   - CLAUDE_GATE=off is set in the environment (exploration sessions);
//   - package.json has no "gate" script;
//   - nothing changed since the last green gate (fingerprint of HEAD plus the working tree).
// First failure in a turn: blocks the stop (exit 2) and hands Claude the last 40 lines.
// If this stop was already forced once (stop_hook_active), the gate runs again; a pass is
// recorded, a failure lets Claude stop and shows you a warning, so the hook can never loop.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const IS_WINDOWS = process.platform === "win32";
const TAIL_LINES = 40;
const GATE_TIMEOUT_MS = 540_000; // stays under the 600-second hook timeout in settings.json
const MAX_HASHED_FILE_BYTES = 5 * 1024 * 1024;
const MAX_BUFFER_BYTES = 256 * 1024 * 1024;

function readStdinJson() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function git(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: MAX_BUFFER_BYTES });
  return result.status === 0 ? result.stdout : null;
}

function gateScriptExists() {
  const packageJsonPath = join(ROOT, "package.json");
  if (!existsSync(packageJsonPath)) return false;
  try {
    const scripts = JSON.parse(readFileSync(packageJsonPath, "utf8")).scripts ?? {};
    return typeof scripts.gate === "string" && scripts.gate.trim() !== "";
  } catch {
    return false;
  }
}

function packageManager() {
  if (existsSync(join(ROOT, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(ROOT, "bun.lock")) || existsSync(join(ROOT, "bun.lockb"))) return "bun";
  if (existsSync(join(ROOT, "yarn.lock"))) return "yarn";
  return "npm";
}

function workingTreeFingerprint() {
  const head = git(["rev-parse", "HEAD"]);
  if (head === null) return null; // no commits yet: always run the gate
  const trackedChanges = git(["diff", "HEAD", "--no-color", "--binary"]) ?? "";
  const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"]) ?? "";
  const hash = createHash("sha256").update(head).update("\0").update(trackedChanges);
  for (const relativePath of untracked.split("\0").filter(Boolean).sort()) {
    hash.update("\0").update(relativePath).update("\0");
    try {
      const fullPath = join(ROOT, relativePath);
      if (statSync(fullPath).size <= MAX_HASHED_FILE_BYTES) hash.update(readFileSync(fullPath));
    } catch {
      // A file that vanished during the scan still counts through its path.
    }
  }
  return hash.digest("hex");
}

function lastLines(text, count) {
  return text.trim().split(/\r?\n/).slice(-count).join("\n");
}

function failureReason(run, command) {
  if (run.error && run.error.code === "ETIMEDOUT") return `"${command}" was stopped after ${GATE_TIMEOUT_MS / 1000} seconds`;
  if (run.error) return `"${command}" could not start: ${run.error.message}`;
  if (run.status === null) return `"${command}" was killed by signal ${run.signal}`;
  return `"${command}" exited with code ${run.status}`;
}

if (process.env.CLAUDE_GATE === "off") process.exit(0);

const input = readStdinJson();
if (!gateScriptExists()) process.exit(0);

const gitDirOutput = git(["rev-parse", "--absolute-git-dir"]);
const stampPath = gitDirOutput ? join(gitDirOutput.trim(), "claude-gate-stamp") : null;
const fingerprint = stampPath ? workingTreeFingerprint() : null;

if (stampPath && fingerprint && existsSync(stampPath) && readFileSync(stampPath, "utf8").trim() === fingerprint) {
  process.exit(0); // nothing changed since the last green gate
}

const pm = packageManager();
const command = `${pm} run gate`;
const run = spawnSync(pm, ["run", "gate"], {
  cwd: ROOT,
  encoding: "utf8",
  shell: IS_WINDOWS,
  timeout: GATE_TIMEOUT_MS,
  maxBuffer: MAX_BUFFER_BYTES,
  env: { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" },
});

if (run.status === 0 && !run.error) {
  if (stampPath && fingerprint) writeFileSync(stampPath, `${fingerprint}\n`);
  process.exit(0);
}

const reason = failureReason(run, command);
const output = lastLines(`${run.stdout ?? ""}\n${run.stderr ?? ""}`, TAIL_LINES);

if (input.stop_hook_active === true) {
  process.stdout.write(JSON.stringify({ systemMessage: `Stop gate still failing: ${reason}.\n${output}` }));
  process.exit(0);
}

process.stderr.write(
  `Stop gate failed: ${reason}. Fix the cause, re-run the narrowest test, then finish the run.\nLast ${TAIL_LINES} lines:\n${output}\n`,
);
process.exit(2);
