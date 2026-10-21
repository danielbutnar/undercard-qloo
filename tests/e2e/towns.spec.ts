// M6d: the same brief in other towns, one click from the bill. Locally the synthetic server
// seeds a saved build for every town; on a deployment a town shows only once its build is saved.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.describe("the same brief in other towns", () => {
  test.skip(SYNTHETIC === "empty", "needs saved builds");

  test("the switcher sits one click from the bill and opens a town's own bill and rooms", async ({
    page,
  }) => {
    await page.goto("/");
    const towns = page.getByRole("navigation", {
      name: "Same brief, other towns",
    });
    test.skip(
      (await towns.count()) === 0,
      "no other town has a saved build on this deployment yet",
    );
    await expect(towns.getByRole("link", { name: "Boise" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const other = towns.getByRole("link").nth(1);
    const city = (await other.textContent())!.trim();
    await other.click();

    await expect(page).toHaveURL(new RegExp(`/towns/${city.toLowerCase()}$`));
    await expect(page.getByText(new RegExp(`^${city}, `))).toBeVisible();
    await expect(
      page
        .getByRole("list", { name: "Booked headliners" })
        .getByRole("listitem"),
    ).toHaveText(["Khruangbin", "Japanese Breakfast"]);
    // The town's own venues, in the venue switch beside its chart.
    await expect(
      page.getByRole("region", {
        name: `${city} venues whose fans shaped this lineup`,
      }),
    ).toBeVisible();
    const bill = page.getByRole("region", { name: "Undercard draft" });
    await expect(bill.getByRole("article")).toHaveCount(10);
    await expect(
      page
        .getByRole("navigation", { name: "Same brief, other towns" })
        .getByRole("link", { name: city }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("a town that isn't on show is a 404, not an empty bill", async ({
    page,
  }) => {
    const response = await page.goto("/towns/paris");
    expect(response?.status()).toBe(404);
  });
});
