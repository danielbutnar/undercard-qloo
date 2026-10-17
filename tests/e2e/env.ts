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
