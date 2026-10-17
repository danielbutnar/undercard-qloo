// Which server the specs run against. Without E2E_BASE_URL, playwright.config.ts starts the
// local server in synthetic mode ("1": the synthetic saved build). Against a production build
// of your own, set UNDERCARD_E2E_SYNTHETIC to the value that server runs with ("1" or "empty").
// Against a deployment, leave it unset: null.
export const SYNTHETIC: "1" | "empty" | null =
  process.env.UNDERCARD_E2E_SYNTHETIC === "1" ||
  process.env.UNDERCARD_E2E_SYNTHETIC === "empty"
    ? process.env.UNDERCARD_E2E_SYNTHETIC
    : process.env.E2E_BASE_URL
      ? null
      : "1";

// A deployment's e2e makes no Qloo calls by default: the redraft, the running order and the
// refill (step 4) run against one only with E2E_LIVE_QLOO=1, once after each deploy.
export const LIVE_QLOO = process.env.E2E_LIVE_QLOO === "1";
export const QLOO_SKIP_REASON =
  "calls Qloo on a deployment; run with E2E_LIVE_QLOO=1";
