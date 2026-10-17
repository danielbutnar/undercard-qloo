// The first screen with no saved build: the server read finds nothing, so the page falls back
// to the bill with its slots open and Build undercard, never an error. It runs against a server seeded with
// UNDERCARD_E2E_SYNTHETIC=empty (a production build of your own; see README, Running locally).
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.skip(SYNTHETIC !== "empty", "needs a server with no saved build");

test("with no saved build, the empty board and Build undercard load, never an error", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("list", { name: "Booked headliners" }).getByRole("listitem"),
  ).toHaveText(["Khruangbin", "Japanese Breakfast"]);
  const bill = page.getByRole("region", { name: "Undercard draft" });
  await expect(bill.getByText("Open slot")).toHaveCount(10);
  await expect(bill.getByText("No undercard drafted yet.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Build undercard" }),
  ).toBeVisible();
  await expect(bill.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: /./ })).toHaveCount(0);
});
