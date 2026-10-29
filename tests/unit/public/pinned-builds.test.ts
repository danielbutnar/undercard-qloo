// Daniel, 29 October 11:40: the pinned build records are committed so a fresh clone can name the
// builds the evidence measured. Each entry holds only Undercard's own build id, its town and its
// build date: no Qloo entity id, act name, ranking or anything else read from a Qloo answer. This
// guard reads every committed record, the 1.0 builds of 21 October and the 2.0 builds the
// pointer move names.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECKED_TOWNS } from "@/lib/checked-towns";

const DATA = new URL("../../../src/data/", import.meta.url);
const RECORDS = readdirSync(DATA).filter((file) =>
  /^pinned-builds-\d{4}-\d{2}-\d{2}\.json$/.test(file),
);
// Undercard's build ids are lowercase random UUIDs; Qloo's entity ids are uppercase.
const BUILD_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const QLOO_ID = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/;

describe("the committed pinned build records", () => {
  it("include the 1.0 builds of 21 October", () => {
    expect(RECORDS).toContain("pinned-builds-2026-10-21.json");
  });

  for (const file of RECORDS)
    it(`${file}: each checked town once, with only its build id and build date`, () => {
      const text = readFileSync(new URL(file, DATA), "utf8");
      const record = JSON.parse(text);
      expect(Object.keys(record).sort()).toEqual(["about", "builds", "readAt"]);
      expect(
        record.builds.map((build: { town: string }) => build.town).sort(),
      ).toEqual(CHECKED_TOWNS.map((town) => town.city).sort());
      for (const build of record.builds) {
        expect(Object.keys(build).sort()).toEqual([
          "buildId",
          "createdAt",
          "town",
        ]);
        expect(build.buildId).toMatch(BUILD_ID);
        expect(new Date(build.createdAt).toISOString()).toBe(build.createdAt);
      }
      expect(text).not.toMatch(QLOO_ID);
      expect(text).not.toMatch(/urn:|qloo:/i);
    });
});
