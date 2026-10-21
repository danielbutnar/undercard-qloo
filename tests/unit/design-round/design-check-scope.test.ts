// The design scanner's section C lines: a rejected look that is still live is banned only where
// the new work happens (an `in:` scope), so `pnpm gate` keeps passing until the look is replaced.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCANNER = resolve("scripts/design-check.mjs");
const dirs: string[] = [];

function project(bans: string, files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "design-check-"));
  dirs.push(root);
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs/design-bans.md"), `## C. Rejected\n${bans}\n`);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

function scan(root: string) {
  const run = spawnSync(process.execPath, [SCANNER, "scan", "src"], {
    cwd: root,
    encoding: "utf8",
  });
  return { status: run.status, out: run.stdout.replace(/\\/g, "/") };
}

const LIVE = 'const display = "Big_Shoulders";\n';

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("section C scan scopes", () => {
  it("a C line without a scope bans the pattern everywhere in src", () => {
    const root = project(
      "- C1 The old look (2026-10-18) scan: `big[_ -]?shoulders`",
      {
        "src/app/lab/new.tsx": LIVE,
        "src/components/live.tsx": LIVE,
      },
    );
    const { status, out } = scan(root);
    expect(status).toBe(1);
    expect(out).toContain("src/app/lab/new.tsx");
    expect(out).toContain("src/components/live.tsx");
  });

  it("an in: scope bans the pattern only under that path", () => {
    const root = project(
      "- C1 The old look (2026-10-18) scan: `big[_ -]?shoulders` in: `src/app/lab`",
      { "src/app/lab/new.tsx": LIVE, "src/components/live.tsx": LIVE },
    );
    const { status, out } = scan(root);
    expect(status).toBe(1);
    expect(out).toContain("src/app/lab/new.tsx");
    expect(out).not.toContain("src/components/live.tsx");
    // The finding names the look, not the scan syntax.
    expect(out).toContain("[C1] The old look (2026-10-18)\n");
  });

  it("a scoped look that only the live code still uses passes", () => {
    const root = project(
      "- C1 The old look (2026-10-18) scan: `big[_ -]?shoulders` in: `src/app/lab`",
      {
        "src/app/lab/new.tsx": "const display = 'Archivo';\n",
        "src/app/labs.tsx": LIVE,
      },
    );
    expect(scan(root).status).toBe(0);
  });
});
