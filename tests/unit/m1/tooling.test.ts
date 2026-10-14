import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import playwrightConfig from "../../../playwright.config";

const manifest = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> };
const { scripts } = manifest;

describe("project tooling", () => {
  it("gate runs typecheck, lint, every unit test and the design-ban scan", () => {
    expect(scripts.gate).toBe(
      "pnpm typecheck && pnpm lint && pnpm test && node scripts/design-check.mjs scan",
    );
    expect(scripts.typecheck).toContain("tsc --noEmit");
    expect(scripts.lint).toMatch(/^eslint\b/);
    expect(scripts.test).toBe("vitest run");
  });

  it("e2e runs Playwright from tests/e2e", () => {
    expect(scripts.e2e).toMatch(/^playwright test\b/);
    expect(playwrightConfig.testDir).toBe("tests/e2e");
  });
});
