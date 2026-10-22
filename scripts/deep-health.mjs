// The daily smoke workflow's deep health check (.github/workflows/smoke.yml): one GET of
// /api/health/deep on E2E_BASE_URL with the HEALTH_TOKEN repository secret. The run fails
// unless Qloo and Anthropic both answer ok; it passes with a notice when the secret isn't set or
// the route answers 429 (the day's checks are used). The token is never printed. From the root:
//   E2E_BASE_URL=https://undercard-daniel-51ed.vercel.app HEALTH_TOKEN=... node scripts/deep-health.mjs
import { pathToFileURL } from "node:url";

// Longer than the route's own 120 s, so a slow check ends in the route's answer, not here.
const TIMEOUT_MS = 150_000;

/** @type {Record<number, string>} */
const HINTS = {
  401: " The token doesn't match production's HEALTH_TOKEN.",
  404: " Production has no HEALTH_TOKEN set, or the route isn't deployed.",
};

/**
 * One deep health check: whether the run passes, and the one line to print.
 * @param {{ baseUrl?: string, token?: string, fetch?: typeof globalThis.fetch }} options
 * @returns {Promise<{ pass: boolean, line: string }>}
 */
export async function deepHealthStep({
  baseUrl,
  token,
  fetch = globalThis.fetch,
}) {
  const secret = token?.trim();
  if (!secret)
    return {
      pass: true,
      line: "::notice::The HEALTH_TOKEN secret isn't set, so the deep health check didn't run.",
    };
  if (!baseUrl)
    return {
      pass: false,
      line: "::error::E2E_BASE_URL isn't set, so the deep health check had nowhere to go.",
    };

  let response;
  try {
    response = await fetch(new URL("/api/health/deep", baseUrl), {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return {
      pass: false,
      line: "::error::The deep health check got no answer.",
    };
  }
  if (response.status === 429)
    return {
      pass: true,
      line: "::notice::The deep health check answered 429: today's checks are used, so it didn't run.",
    };
  if (response.status !== 200)
    return {
      pass: false,
      line: `::error::The deep health check answered HTTP ${response.status}.${HINTS[response.status] ?? ""}`,
    };

  /** @type {{ qloo?: unknown, anthropic?: unknown, ms?: unknown } | null} */
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: both read as fail below.
  }
  const qloo = body?.qloo === "ok" ? "ok" : "fail";
  const anthropic = body?.anthropic === "ok" ? "ok" : "fail";
  const time = typeof body?.ms === "number" ? ` in ${body.ms} ms` : "";
  const summary = `Qloo ${qloo}, Anthropic ${anthropic}${time}`;
  return qloo === "ok" && anthropic === "ok"
    ? { pass: true, line: `Deep health check: ${summary}.` }
    : { pass: false, line: `::error::Deep health check: ${summary}.` };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const { pass, line } = await deepHealthStep({
    baseUrl: process.env.E2E_BASE_URL,
    token: process.env.HEALTH_TOKEN,
  });
  console.log(line);
  process.exitCode = pass ? 0 : 1;
}
