// M8a: the running order, one click from the bill. On a deployment it calls Qloo (at most 10
// calls, cached after the first time for the same bill); on the synthetic server, which has no
// Qloo client, it's answered in the browser.
import { expect, test, type Page } from "@playwright/test";
import { planRunningOrder } from "../../src/lib/running-order";
import { SAGEBRUSH_SOUND } from "../../src/lib/sagebrush";
import { SYNTHETIC } from "./env";

const NDJSON = "application/x-ndjson; charset=utf-8";
const bill = (page: Page) =>
  page.getByRole("region", { name: "Undercard draft" });

test("the running order puts two acts on at a time, each set saying who plays against whom", async ({
  page,
}) => {
  test.setTimeout(90_000);
  if (SYNTHETIC)
    await page.route("**/api/running-order", async (route) => {
      const { acts } = route.request().postDataJSON() as {
        acts: Parameters<typeof planRunningOrder>[0];
      };
      const slots = planRunningOrder(acts, () => 0.85, SAGEBRUSH_SOUND.feeBands);
      await route.fulfill({
        status: 200,
        contentType: NDJSON,
        body: [
          {
            type: "call",
            call: {
              n: 1,
              tool: "running_order",
              endpoint: "/v2/insights",
              summary: "Running order: how much the first act's fans like the other Opener acts",
              params: [],
              resultCount: 5,
              ms: 300,
              cached: false,
            },
          },
          { type: "running-order", slots },
          { type: "done", calls: 1, ms: 300 },
        ]
          .map((event) => JSON.stringify(event))
          .join("\n"),
      });
    });
  await page.goto("/");
  await expect(bill(page).getByRole("article")).toHaveCount(10);
  await bill(page).getByRole("button", { name: "Running order" }).click();
  const panel = page.getByRole("region", { name: "Running order" });
  await expect(panel).toBeVisible({ timeout: 60_000 });
  const sets = panel.getByRole("listitem");
  await expect(sets).toHaveCount(5);
  for (const set of await sets.all()) {
    await expect(set).toContainText("Main stage:");
    await expect(set).toContainText(/plays against .+: their fans overlap \d\.\d\d/);
  }
  await expect(sets.first()).toContainText("Opening acts");
  await expect(sets.last()).toContainText("Mid-size acts");
  const rows = page
    .getByRole("list", { name: "Qloo calls" })
    .locator(":scope > li")
    .filter({ hasText: "Running order:" });
  expect(await rows.count()).toBeGreaterThanOrEqual(1);
  expect(await rows.count()).toBeLessThanOrEqual(10);
});
