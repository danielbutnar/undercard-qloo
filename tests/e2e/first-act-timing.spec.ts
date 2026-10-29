// SPEC section 3, step 2: "the first act lands within 3 seconds" of pressing Watch, measured on
// a deployment only (E2E_BASE_URL). Three presses of Watch per screen size, each on a fresh page,
// timed from the click's own event to the first act on the poster stamped in (fully opaque, as
// tests/e2e/watch-pace.spec.ts reads it). A soft result (Daniel, 30 Oct, 00:40): it reports the
// medians as annotations and in the log, marked within or over 3 s, and never fails, so it can't
// fail the demo path or trigger a rollback; run it on its own:
//   E2E_BASE_URL=<deployment> pnpm e2e tests/e2e/first-act-timing.spec.ts --workers=1
// A replay reads the saved build and the Qloo cache only: no Qloo or model call, and no limit.
import { test, type Page } from "@playwright/test";

const PRESSES = 3;
const BUDGET_MS = 3_000;

/** One press of Watch on a fresh page: ms from the click to the first act stamped in, or null. */
async function firstActAfterWatch(page: Page): Promise<number | null> {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    const state = window as unknown as {
      __pressed?: number;
      __landed?: number;
    };
    const opaqueAct = () =>
      [
        ...document.querySelectorAll(
          '[aria-label="Undercard draft"] .poster-act',
        ),
      ].some((act) => Number(getComputedStyle(act).opacity) > 0.95);
    // Armed by the click: the poster empties as Watch starts, then the first act stamps in.
    let emptied = false;
    const watch = () => {
      if (state.__landed !== undefined) return;
      if (state.__pressed !== undefined) {
        if (!emptied) emptied = !opaqueAct();
        else if (opaqueAct()) {
          state.__landed = performance.now();
          return;
        }
      }
      requestAnimationFrame(watch);
    };
    document.addEventListener(
      "click",
      (event) => {
        if (
          (event.target as Element | null)
            ?.closest("button")
            ?.textContent?.includes("Watch the AI agent build it")
        )
          state.__pressed = event.timeStamp;
      },
      { capture: true, once: true },
    );
    requestAnimationFrame(watch);
  });
  await page
    .getByRole("button", { name: "Watch the AI agent build it" })
    .click();
  const landed = await page
    .waitForFunction(
      () => (window as unknown as { __landed?: number }).__landed !== undefined,
      undefined,
      { timeout: 20_000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!landed) return null;
  return page.evaluate(() => {
    const state = window as unknown as { __pressed: number; __landed: number };
    return Math.round(state.__landed - state.__pressed);
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  test.describe(`the first act at ${viewport.width}x${viewport.height}`, () => {
    test.skip(!process.env.E2E_BASE_URL, "times a deployment's replay");
    test.use({ viewport });

    test(`the median of ${PRESSES} presses of Watch, against ${BUDGET_MS / 1000} s (a soft result)`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const times: (number | null)[] = [];
      for (let press = 0; press < PRESSES; press++)
        times.push(await firstActAfterWatch(page));
      const landed = times.filter((time): time is number => time !== null);
      const median =
        landed.length === PRESSES
          ? [...landed].sort((a, b) => a - b)[Math.floor(PRESSES / 2)]
          : null;
      const verdict =
        median === null
          ? `no act within 20 s on ${PRESSES - landed.length} of ${PRESSES} presses`
          : median <= BUDGET_MS
            ? "within 3 s"
            : "OVER 3 s";
      const line = `${viewport.width}x${viewport.height}: ${times.map((time) => (time === null ? "none" : `${time} ms`)).join(", ")}; median ${median === null ? "none" : `${median} ms`}: ${verdict}`;
      test
        .info()
        .annotations.push({ type: "first act (soft)", description: line });
      console.log(`first act ${line}`);
    });
  });
