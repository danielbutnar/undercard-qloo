// M8c: the buyer keeps three acts and redrafts the rest. On a deployment the redraft calls Qloo
// (at most 3 calls); on the synthetic server, which has no Qloo client, it's answered in the
// browser.
import { expect, test, type Page } from "@playwright/test";
import { LIVE_QLOO, QLOO_SKIP_REASON, SYNTHETIC } from "./env";
import { syntheticRedraftStream } from "./synthetic-build";

const NDJSON = "application/x-ndjson; charset=utf-8";
const bill = (page: Page) =>
  page.getByRole("region", { name: "Undercard draft" });

test("keeps three acts, redrafts, and only the other slots change", async ({
  page,
}) => {
  test.skip(!SYNTHETIC && !LIVE_QLOO, QLOO_SKIP_REASON);
  test.setTimeout(90_000);
  if (SYNTHETIC)
    await page.route("**/api/redraft", async (route) => {
      const body = route.request().postDataJSON() as {
        replace: { entityId: string; band: "mid" | "opener" }[];
      };
      await route.fulfill({
        status: 200,
        contentType: NDJSON,
        body: syntheticRedraftStream(body.replace),
      });
    });
  await page.goto("/");
  const articles = bill(page).getByRole("article");
  await expect(articles).toHaveCount(10);
  const before = await articles.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label")!),
  );
  const kept = [before[0], before[4], before[5]];
  for (const name of kept) {
    await bill(page).getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("region", { name: "Act card" })
      .getByRole("button", { name: "Keep" })
      .click();
  }
  await expect(bill(page).getByText("Kept", { exact: true })).toHaveCount(3);
  await bill(page).getByRole("button", { name: "Redraft the rest" }).click();
  await expect(
    bill(page).getByRole("button", { name: "Redraft the rest" }),
  ).toBeEnabled({ timeout: 60_000 });

  const after = await articles.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label")!),
  );
  for (const name of kept) expect(after).toContain(name);
  const others = before.filter((name) => !kept.includes(name));
  const changed = others.filter((name) => !after.includes(name));
  expect(changed.length).toBeGreaterThan(0);
  // The trace lists the redraft's calls: at most 3.
  const redraftRows = page
    .getByRole("list", { name: "Qloo calls" })
    .locator(":scope > li")
    .filter({ hasText: "Redraft:" });
  const rows = await redraftRows.count();
  expect(rows).toBeGreaterThanOrEqual(1);
  expect(rows).toBeLessThanOrEqual(3);
});
