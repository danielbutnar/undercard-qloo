import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const WORKFLOW = ".github/workflows/gate.yml";

describe("the CI workflow", () => {
  it("exists", () => {
    expect(existsSync(WORKFLOW)).toBe(true);
  });

  const yaml = existsSync(WORKFLOW) ? readFileSync(WORKFLOW, "utf8") : "";

  it("runs on every push to main and on pull requests", () => {
    expect(yaml).toMatch(/push:\s*\n\s*branches:\s*\[\s*main\s*\]/);
    expect(yaml).toMatch(/\bpull_request:/);
  });

  it("installs from the lockfile with pnpm on Node 22, then runs pnpm gate", () => {
    expect(yaml).toMatch(/node-version:\s*22\b/);
    expect(yaml).toMatch(/pnpm\/action-setup@v\d/);
    expect(yaml).toMatch(/pnpm install --frozen-lockfile/);
    expect(yaml).toMatch(/run:\s*pnpm gate\b/);
  });

  it("needs no secrets and can only read the repository", () => {
    expect(yaml).not.toMatch(/secrets\./);
    expect(yaml).toMatch(/permissions:\s*\n\s*contents:\s*read/);
  });
});

describe("README.md", () => {
  it("shows the workflow's status badge", () => {
    expect(readFileSync("README.md", "utf8")).toContain(
      "https://github.com/danielbutnar/undercard/actions/workflows/gate.yml/badge.svg?branch=main",
    );
  });
});
