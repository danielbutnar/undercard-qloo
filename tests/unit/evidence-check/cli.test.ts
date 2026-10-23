// WS11 (Daniel's brief of 2026-10-22), step 4: `pnpm evidence:check`, outside `pnpm gate`. It
// replays production's saved builds unless --base names another server, reads the store when
// the environment has one (else the raw files under --design), prints one table and exits 1 on
// any recomputable mismatch. Here against the synthetic build, with invented claims.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  main,
  parseArgs,
  PRODUCTION,
  type Claim,
  type Computation,
} from "../../../scripts/evidence-check";
import { POST } from "@/app/api/undercard/route";
import { createQlooCache, SYNTHETIC_ENV } from "@/server/qloo-cache";

const routeFetch: typeof fetch = async (input, init) =>
  POST(new Request(input instanceof Request ? input.url : input, init));

const DOC = [
  "The Lantern Room lifted 7 acts, Fort Street Ballroom 4.",
  "Of the model's 10 picks, 1 passes all three; the first run took 9 minutes.",
].join("\n");

const claims: Claim<Computation>[] = [
  {
    file: "doc.md",
    phrase: "The Lantern Room lifted {7} acts",
    equals: { kind: "venue-acts", town: "Boise", venue: "The Lantern Room" },
  },
  {
    file: "doc.md",
    phrase: "Fort Street Ballroom {4}",
    equals: {
      kind: "venue-acts",
      town: "Boise",
      venue: "Fort Street Ballroom",
    },
  },
  {
    file: "doc.md",
    phrase: "{1} passes all three",
    equals: { kind: "without", count: "allThree" },
  },
  {
    file: "doc.md",
    phrase: "the first run took 9 minutes",
    equals: "not recomputable",
    why: "a run that was never saved",
  },
];

beforeAll(() => {
  vi.stubEnv(SYNTHETIC_ENV, "1");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

async function run(list: Claim<Computation>[]) {
  const lines: string[] = [];
  const code = await main(["--base", "http://synthetic.test", "--no-raw"], {
    claims: list,
    fetch: routeFetch,
    store: createQlooCache({ [SYNTHETIC_ENV]: "1" }),
    read: (file) => (file === "doc.md" ? DOC : null),
    print: (line) => lines.push(line),
  });
  return { code, out: lines.join("\n") };
}

describe("pnpm evidence:check", () => {
  it("replays production by default, and takes another server, the .design folder and no store or raw files as flags", () => {
    expect(PRODUCTION).toBe("https://undercard-daniel-51ed.vercel.app");
    expect(parseArgs([])).toEqual({
      base: PRODUCTION,
      design: ".design",
      store: true,
      raw: true,
    });
    expect(
      parseArgs([
        "--base",
        "http://localhost:3103",
        "--design",
        "C:/Users/someone/undercard/.design",
        "--no-store",
        "--no-raw",
      ]),
    ).toEqual({
      base: "http://localhost:3103",
      design: "C:/Users/someone/undercard/.design",
      store: false,
      raw: false,
    });
    expect(() => parseArgs(["--fresh"])).toThrow(/--fresh/);
    expect(() => parseArgs(["--base"])).toThrow(/--base/);
  });

  it("prints where its numbers came from, one table and a count, and exits 1 on a mismatch", async () => {
    const { code, out } = await run(claims);
    expect(code).toBe(1);
    expect(out).toContain("http://synthetic.test");
    expect(out).toContain("29 replay-only requests");
    expect(out).toContain("4 saved builds");
    expect(out).toContain("Without Qloo: the store, read-only, 1 town");
    expect(out).toMatch(/no run record/);
    const table = out.split("\n").filter((line) => line.startsWith("|"));
    expect(table).toHaveLength(2 + claims.length);
    expect(table[2]).toMatch(
      /^\| match \| doc\.md \| The Lantern Room lifted \{7\} acts \| 7 \| 7 \|/,
    );
    expect(table[3]).toMatch(
      /^\| differs \| doc\.md \| Fort Street Ballroom \{4\} \| 4 \| 3 \|/,
    );
    expect(table[4]).toMatch(/^\| match \|/);
    expect(table[5]).toMatch(/^\| not recomputable \|/);
    expect(out).toContain(
      "4 claims: 2 match, 1 differs, 0 have no data, 0 not found, 0 bad, 1 not recomputable.",
    );
  });

  it("exits 0 when every recomputable claim matches", async () => {
    const { code } = await run([claims[0], claims[2], claims[3]]);
    expect(code).toBe(0);
  });

  it("is a package script outside pnpm gate", () => {
    const { scripts } = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(scripts["evidence:check"]).toBe(
      "node --experimental-transform-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/register-ts.mjs scripts/evidence-check.ts",
    );
    expect(scripts.gate).not.toMatch(/evidence/);
  });
});
