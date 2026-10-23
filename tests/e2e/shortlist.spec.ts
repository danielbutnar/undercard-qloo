// WS4, the buyer's shortlist (/shortlist): the page calls no Qloo on load; a check sorts the
// pasted acts by climb, says a name Qloo doesn't know is not found, and lists its Qloo calls; the
// limit's friendly message; a phone width. A check runs on the synthetic server only: its names
// are invented, answered from tests/e2e/synthetic-build.ts with no network.
import { expect, test, type Page } from "@playwright/test";
import { SYNTHETIC } from "./env";

const LEAD =
  "Paste the acts you've been pitched; Undercard sorts them by how fans of this town's venues rank them. You make every call.";
const LIMIT =
  "You've used today's 5 shortlist checks from this network. Try again tomorrow (UTC).";
const SYNTHETIC_ONLY = "a check's invented names are the synthetic server's";

// Each test checks from a network of its own, so reruns against a reused server never share a
// day's allowance.
test.beforeEach(async ({ page }, info) => {
  await page.setExtraHTTPHeaders({
    "x-real-ip": `e2e-shortlist-${info.testId}-${Date.now()}`,
  });
});

async function check(page: Page, names: string[]) {
  await page
    .getByRole("textbox", { name: /acts you've been pitched/i })
    .fill(names.join("\n"));
  await page.getByRole("button", { name: "Sort them on Qloo" }).click();
  return page.getByRole("region", { name: "Sorted for Boise's venues" });
}

test("opens on its sentence and the form, and calls Qloo for nothing on load", async ({
  page,
}) => {
  const checks: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/shortlist")) checks.push(request.url());
  });
  await page.goto("/shortlist");

  await expect(page.getByText(LEAD)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Town" })).toHaveValue(
    "sagebrush-sound",
  );
  await expect(
    page.getByRole("button", { name: "Sort them on Qloo" }),
  ).toBeEnabled();
  await page.waitForLoadState("networkidle");
  expect(checks).toEqual([]);
});

test("sorts the pasted acts by climb, lists the calls, and says a name Qloo doesn't know is not found", async ({
  page,
}) => {
  test.skip(SYNTHETIC !== "1", SYNTHETIC_ONLY);
  await page.goto("/shortlist");

  const results = await check(page, [
    "Velvet Coyote",
    "Marigold Static",
    "Glass Harbor Nowhere",
  ]);

  const rows = results
    .getByRole("list", { name: "Your acts, by climb" })
    .getByRole("article");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toHaveAccessibleName("Marigold Static");
  await expect(rows.first()).toContainText(
    "The Lantern Room's fans lift it 1 place, 2nd to 1st",
  );
  await expect(rows.first()).toContainText(
    "Qloo popularity 86th · in the mid-size range",
  );
  await expect(rows.last()).toHaveAccessibleName("Glass Harbor Nowhere");
  await expect(rows.last()).toContainText("Not found on Qloo");
  await expect(
    results.getByText("Qloo had no fan data for Cottonwood Social Hall"),
  ).toBeVisible();
  const calls = page.getByRole("complementary", { name: "Qloo calls" });
  await expect(
    calls.getByRole("list", { name: "Qloo calls" }).locator(":scope > li"),
  ).toHaveCount(7);
});

test("shows the limit's friendly message when the day's checks are used", async ({
  page,
}) => {
  await page.route("**/api/shortlist", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: { "retry-after": "3600" },
      body: JSON.stringify({ error: LIMIT, code: "limit" }),
    }),
  );
  await page.goto("/shortlist");

  await check(page, ["Velvet Coyote"]);

  // Scoped to the page's main: Next.js adds its own empty role="alert" route announcer.
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(LIMIT);
  await expect(
    page.getByRole("button", { name: "Sort them on Qloo" }),
  ).toBeEnabled();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("fits 390 wide, before and after a check, and brings the sorted acts into view", async ({
    page,
  }) => {
    test.skip(SYNTHETIC !== "1", SYNTHETIC_ONLY);
    await page.goto("/shortlist");
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
    await expect(page.getByText(LEAD)).toBeVisible();
    expect(await overflow()).toBe(0);

    const results = await check(page, [
      "Velvet Coyote",
      "Marigold Static",
      "Dusk Arcade",
      "Lowland Choir",
    ]);

    await expect(
      results.getByRole("heading", { name: "Sorted for Boise's venues" }),
    ).toBeInViewport();
    await expect(
      results
        .getByRole("list", { name: "Your acts, by climb" })
        .getByRole("article"),
    ).toHaveCount(4);
    expect(await overflow()).toBe(0);
  });
});
