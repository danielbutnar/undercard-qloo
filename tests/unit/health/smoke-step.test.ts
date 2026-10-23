// The daily smoke workflow's deep health check (scripts/deep-health.mjs, run by
// .github/workflows/smoke.yml): one GET of /api/health/deep with the HEALTH_TOKEN secret. It
// fails the run unless both services say ok, and passes with a notice when the secret isn't set
// or the route answers 429. Fetch is stubbed; the spawned script never reaches the network.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { deepHealthStep } from "../../../scripts/deep-health.mjs";

const BASE = "https://undercard.synthetic.invalid";
const TOKEN = "synthetic-health-token-4f1c9a";

function stub(answer: () => Response | Promise<Response>) {
  const fetch = vi.fn<(url: URL, init?: RequestInit) => Promise<Response>>(
    async () => answer(),
  );
  return { fetch, step: fetch as unknown as typeof globalThis.fetch };
}

const health = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("deepHealthStep", () => {
  it("without the secret: passes with a notice and sends nothing", async () => {
    const { fetch, step } = stub(() => health({}));
    for (const token of [undefined, "", "  "]) {
      const result = await deepHealthStep({
        baseUrl: BASE,
        token,
        fetch: step,
      });
      expect(result.pass).toBe(true);
      expect(result.line).toMatch(/^::notice::.*HEALTH_TOKEN/);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("both ok: passes, after one GET of /api/health/deep with the bearer token", async () => {
    const { fetch, step } = stub(() =>
      health({ qloo: "ok", anthropic: "ok", ms: 1234 }),
    );
    const result = await deepHealthStep({
      baseUrl: BASE,
      token: TOKEN,
      fetch: step,
    });
    expect(result).toEqual({
      pass: true,
      line: "Deep health check: Qloo ok, Anthropic ok in 1234 ms.",
    });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/api/health/deep`);
    expect(new Headers(init?.headers).get("authorization")).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it("a 429: passes with a notice", async () => {
    const { step } = stub(() =>
      health({ error: "Today's checks are used." }, 429),
    );
    const result = await deepHealthStep({
      baseUrl: BASE,
      token: TOKEN,
      fetch: step,
    });
    expect(result.pass).toBe(true);
    expect(result.line).toMatch(/^::notice::.*429/);
  });

  it("either service failing: fails the run, naming which", async () => {
    for (const [body, words] of [
      [{ qloo: "fail", anthropic: "ok", ms: 50 }, "Qloo fail, Anthropic ok"],
      [{ qloo: "ok", anthropic: "fail", ms: 50 }, "Qloo ok, Anthropic fail"],
      [
        { qloo: "fail", anthropic: "fail", ms: 50 },
        "Qloo fail, Anthropic fail",
      ],
    ] as const) {
      const { step } = stub(() => health(body));
      const result = await deepHealthStep({
        baseUrl: BASE,
        token: TOKEN,
        fetch: step,
      });
      expect(result.pass).toBe(false);
      expect(result.line).toMatch(/^::error::/);
      expect(result.line).toContain(words);
    }
  });

  it("any other status, no answer, or an answer that isn't the check's: fails the run", async () => {
    const answers: (() => Response | Promise<Response>)[] = [
      () => health({ error: "Unauthorized." }, 401),
      () => health({ error: "Not found." }, 404),
      () => new Response("", { status: 504 }),
      () => new Response("not json", { status: 200 }),
      () => health({ status: "ok" }),
      () => Promise.reject(new TypeError("synthetic network error")),
    ];
    for (const answer of answers) {
      const { step } = stub(answer);
      const result = await deepHealthStep({
        baseUrl: BASE,
        token: TOKEN,
        fetch: step,
      });
      expect(result.pass).toBe(false);
      expect(result.line).toMatch(/^::error::/);
      expect(result.line).not.toContain(TOKEN);
    }
  });
});

describe("scripts/deep-health.mjs as the workflow runs it", () => {
  const run = (env: Record<string, string>) =>
    spawnSync(process.execPath, ["scripts/deep-health.mjs"], {
      env: { ...process.env, ...env },
      encoding: "utf8",
    });

  it("prints the notice and exits 0 without the secret", () => {
    const result = run({ HEALTH_TOKEN: "", E2E_BASE_URL: BASE });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^::notice::/);
  });

  it("exits 1 with an error line when there is no base URL", () => {
    const result = run({ HEALTH_TOKEN: TOKEN, E2E_BASE_URL: "" });
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/^::error::/);
    expect(result.stdout).not.toContain(TOKEN);
  });
});

describe("the smoke workflow", () => {
  const yaml = readFileSync(".github/workflows/smoke.yml", "utf8");
  const step = yaml.slice(yaml.indexOf("- name: Deep health check"));

  it("runs the deep check with the HEALTH_TOKEN secret against production", () => {
    expect(yaml).toContain("- name: Deep health check");
    expect(step).toMatch(/run: node scripts\/deep-health\.mjs/);
    expect(step).toMatch(/HEALTH_TOKEN: \$\{\{ secrets\.HEALTH_TOKEN \}\}/);
    expect(step).toMatch(
      /E2E_BASE_URL: https:\/\/undercard-daniel-51ed\.vercel\.app/,
    );
  });

  // Daniel's message of 2026-10-23, after the 14:34 run failed installing Chromium before any test.
  it("runs only in danielbutnar/undercard, so the public copy never runs it", () => {
    expect(yaml).toMatch(
      /\n {2}smoke:\n(?: {4}#[^\n]*\n)* {4}if: github\.repository == 'danielbutnar\/undercard'\n/,
    );
  });

  // Daniel, 2026-10-23: ubuntu-latest moves to Ubuntu 26 from 19 October, which may be what broke
  // that morning's Playwright install; this workflow and the gate's stay on 24.04 until judging ends.
  it("runs on ubuntu-24.04, as the gate's workflow does", () => {
    for (const file of [
      ".github/workflows/smoke.yml",
      ".github/workflows/gate.yml",
    ]) {
      const text = readFileSync(file, "utf8");
      expect(text).toMatch(/\n {4}runs-on: ubuntu-24\.04\n/);
      expect(text).not.toMatch(/runs-on: ubuntu-latest/);
    }
  });

  it("tries the Playwright install once more when it fails", () => {
    expect(yaml).toContain(
      "run: pnpm exec playwright install --with-deps chromium || (sleep 30 && pnpm exec playwright install --with-deps chromium)",
    );
  });

  it("opens an issue only when the smoke test step itself fails", () => {
    const test = yaml.slice(
      yaml.indexOf("- name: Smoke test against production"),
    );
    expect(test).toMatch(
      /^- name: Smoke test against production\n {8}id: smoke\n/,
    );
    const issue = yaml.slice(
      yaml.indexOf("- name: Open an issue when the smoke test fails"),
    );
    expect(issue).toMatch(
      /if: \$\{\{ failure\(\) && steps\.smoke\.outcome == 'failure' \}\}/,
    );
  });

  it("runs it even when the smoke test failed, before the step that opens an issue", () => {
    expect(step).toMatch(/if: \$\{\{ !cancelled\(\) \}\}/);
    expect(yaml.indexOf("- name: Deep health check")).toBeLessThan(
      yaml.indexOf("- name: Open an issue when the smoke test fails"),
    );
  });
});
