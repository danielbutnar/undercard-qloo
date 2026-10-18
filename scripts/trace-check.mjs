#!/usr/bin/env node
// After `pnpm build`, checks what each route's server trace (.next/server/**/*.nft.json) would
// carry into a deployment: nothing from .design (local shots, clips and Qloo-derived evidence) and
// no project source outside node_modules and .next. Run it before any deploy made from this
// machine (design round, step 5).   node scripts/trace-check.mjs     exits 1 on a finding
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = join(".next", "server");
if (!existsSync(ROOT)) {
  console.error("No .next/server: run `pnpm build` first.");
  process.exit(2);
}

function traces(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return traces(path);
    return entry.name.endsWith(".nft.json") ? [path] : [];
  });
}

let findings = 0;
for (const trace of traces(ROOT)) {
  const files = JSON.parse(readFileSync(trace, "utf8")).files.map((file) =>
    relative(process.cwd(), resolve(dirname(trace), file)).replace(/\\/g, "/"),
  );
  const carried = files.filter(
    (file) =>
      !file.startsWith("node_modules/") &&
      !file.startsWith(".next/") &&
      !file.startsWith("../"),
  );
  if (carried.length === 0) continue;
  findings += 1;
  console.log(
    `${relative(ROOT, trace)} carries ${carried.length} project files, such as:`,
  );
  for (const file of carried.slice(0, 5)) console.log(`   ${file}`);
}
console.log(
  findings
    ? `\n${findings} route traces carry project files into a deployment.`
    : "Trace check: no route carries .design or other project files.",
);
process.exit(findings ? 1 : 0);
