// WS2 (b): the agent's switch, from the saved trace only. Where a planner line said after a
// venue's result names the next venue read, How it works and Watch add one sentence; on a trace
// without one they add nothing. Watch's replay is answered in the browser with the town's own
// synthetic build and an edition per venue, so each venue's step holds long enough to read.
import { expect, test, type Page } from "@playwright/test";
import type { SavedBuild } from "../../src/server/build-store";
import { townBySlug } from "../../src/lib/towns";
import { SYNTHETIC } from "./env";
import {
  syntheticReplayStream,
  syntheticSavedBuild,
  syntheticTownBuild,
} from "./synthetic-build";

const NDJSON = "application/x-ndjson; charset=utf-8";
const SWITCH =
  "Cottonwood Social Hall's fans moved no act onto the lineup, so the agent read Fort Street Ballroom; 3 acts come from that read.";

async function watch(page: Page, path: string, build: SavedBuild) {
  await page.route("**/api/undercard", (route) =>
    route.fulfill({
      status: 200,
      contentType: NDJSON,
      body: syntheticReplayStream(build),
    }),
  );
  await page.goto(path);
  await page
    .getByRole("button", { name: "Watch how it picked these acts" })
    .click();
  return page.getByRole("region", { name: "Undercard draft" });
}

test.describe("the agent's switch, from the saved trace", () => {
  test.skip(SYNTHETIC !== "1", "reads the synthetic saved builds");

  test("Watch says why the agent read Fort Street Ballroom, on a trace whose planner switched", async ({
    page,
  }) => {
    const nashville = townBySlug("nashville")!.festival.id;
    const bill = await watch(
      page,
      "/towns/nashville",
      syntheticTownBuild("nashville", nashville),
    );
    // The first plan's line names its anchors: the one-line key sits under it.
    await expect(
      bill.getByText("Anchors are the venues whose fans it reads."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(bill.getByText("+ Fort Street Ballroom's fans")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      bill.getByText(
        "The AI agent's plan: Cottonwood Social Hall lifted no act; try Fort Street Ballroom for both bands.",
      ),
    ).toBeVisible();
    await expect(bill.getByText(SWITCH)).toBeVisible();
  });

  test("Watch adds nothing on a trace without a switch", async ({ page }) => {
    const bill = await watch(page, "/", syntheticSavedBuild());
    await expect(bill.getByText("+ Cottonwood Social Hall's fans")).toBeVisible(
      { timeout: 20_000 },
    );
    await expect(
      bill.getByText(
        "The AI agent's plan: Try Cottonwood Social Hall for Mid as a third room.",
      ),
    ).toBeVisible();
    await expect(bill.getByText(/so the agent read/)).toHaveCount(0);
  });

  test("How it works adds nothing to the AI agent's choices on a trace without a switch", async ({
    page,
  }) => {
    await page.goto("/method");
    const choices = page.getByRole("region", {
      name: "The AI agent's choices",
    });
    await expect(choices).toContainText(/acts? lifted|lifted none/);
    await expect(choices).not.toContainText("so the agent read");
  });
});
