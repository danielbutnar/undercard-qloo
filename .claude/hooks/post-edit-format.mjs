#!/usr/bin/env node
// Claude Code PostToolUse hook (matcher Edit|Write): formats the file Claude just changed
// with the project's own Prettier. Silent by design: it never prints and never blocks.
// Syntax, type and lint problems are caught later by the Stop gate (stop-gate.mjs).
// Markdown is left alone so SPEC.md, TASKS.md and RULES.md keep their exact formatting.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const FORMATTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".css", ".scss", ".html", ".yml", ".yaml",
]);

function editedFilePath() {
  try {
    const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
    const filePath = payload?.tool_input?.file_path;
    return typeof filePath === "string" ? filePath : "";
  } catch {
    return "";
  }
}

// Finds Prettier's CLI entry through its package.json, so it runs with this Node binary
// on every platform, with no shell and no npx download.
function prettierEntry() {
  const packageDir = join(ROOT, "node_modules", "prettier");
  const manifestPath = join(packageDir, "package.json");
  if (!existsSync(manifestPath)) return "";
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.prettier;
    if (typeof bin !== "string") return "";
    const entry = join(packageDir, bin);
    return existsSync(entry) ? entry : "";
  } catch {
    return "";
  }
}

const filePath = editedFilePath();
if (filePath && existsSync(filePath) && FORMATTED_EXTENSIONS.has(extname(filePath).toLowerCase())) {
  const entry = prettierEntry();
  if (entry) {
    spawnSync(process.execPath, [entry, "--write", filePath], {
      cwd: existsSync(ROOT) ? ROOT : dirname(filePath),
      stdio: "ignore",
      timeout: 20_000,
    });
  }
}

process.exit(0);
