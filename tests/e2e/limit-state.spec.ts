// The designed error state for a fresh build refused at the rate limit. The build route is
// intercepted (a replay of the saved build, then a 429 for the fresh build), so this runs the
// real page in a browser without calling Qloo or Claude, locally or against a deployment.
import { expect, test } from "@playwright/test";
import {
  LIMIT_MESSAGE,
  syntheticBuildStream,
  syntheticLimitStream,
} from "./synthetic-build";

const NDJSON = "application/x-ndjson; charset=utf-8";

test("a refused fresh build keeps the board, shows the limit and offers the replay", async ({
  page,
}) => {
  let replays = 0;
  await page.route("**/api/undercard", async (route) => {
    const { fresh } = (route.request().postDataJSON() ?? {}) as {
      fresh?: boolean;
    };
    if (fresh) {
      await route.fulfill({
        status: 429,
        contentType: NDJSON,
        headers: { "retry-after": "3600" },
        body: syntheticLimitStream(),
      });
      return;
    }
    replays += 1;
    await route.fulfill({
      status: 200,
      contentType: NDJSON,
      body: syntheticBuildStream({ replayed: true }),
    });
  });

  // Scoped to the trace panel: Next.js adds its own empty role="alert" route announcer.
  const trace = page.getByRole("complementary", { name: "Qloo calls" });
  await page.goto("/");
  await page.getByRole("button", { name: "Build undercard" }).click();
  await expect(page.getByRole("article")).toHaveCount(10);

  await page.getByRole("button", { name: "Run the agent again" }).click();
  await expect(trace.getByRole("alert")).toHaveText(LIMIT_MESSAGE);
  await expect(page.getByRole("article")).toHaveCount(10);
  await expect(
    page.getByRole("list", { name: "Qloo calls" }).locator(":scope > li"),
  ).toHaveCount(11);

  await page.getByRole("button", { name: "Replay the saved build" }).click();
  await expect(page.getByText(/^Replayed the build saved/)).toBeVisible();
  await expect(trace.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(10);
  expect(replays).toBe(2);
});
