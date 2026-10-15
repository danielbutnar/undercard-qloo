import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSeed, SEED_FILE, seedJson } from "../../../seed/festival";
import { ticketsSold } from "@/lib/festival";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

const DAY_MS = 24 * 60 * 60 * 1000;

function runSeed(out: string) {
  execFileSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "seed/seed.ts",
      "--out",
      out,
    ],
    {
      stdio: "pipe",
    },
  );
  return readFileSync(out, "utf8");
}

describe("pnpm seed", () => {
  it("builds 30 consecutive days of presale for Sagebrush Sound", () => {
    const festival = buildSeed();
    expect(festival.name).toBe("Sagebrush Sound");
    expect(festival.presale).toHaveLength(30);
    festival.presale.forEach((day, index) => {
      if (index > 0)
        expect(
          Date.parse(day.date) - Date.parse(festival.presale[index - 1].date),
        ).toBe(DAY_MS);
    });
    expect(ticketsSold(festival.presale)).toBeLessThanOrEqual(
      festival.capacity,
    );
  });

  it("writes identical data on every run", () => {
    const dir = mkdtempSync(join(tmpdir(), "undercard-seed-"));
    const first = runSeed(join(dir, "first.json"));
    const second = runSeed(join(dir, "second.json"));
    expect(second).toBe(first);
    expect(first).toBe(seedJson(buildSeed()));
  }, 30_000);

  it("is what the committed seed file holds", () => {
    expect(readFileSync(SEED_FILE, "utf8")).toBe(seedJson(buildSeed()));
  });

  it("is what the app loads", () => {
    expect(SAGEBRUSH_SOUND).toEqual(buildSeed());
  });
});
