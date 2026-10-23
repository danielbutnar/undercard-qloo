// WS2 (b): the agent's switch, from the saved trace only. Where a planner line said after a
// venue's result names the next venue read, How it works and Watch add one sentence; on a trace
// without one they add nothing. Where Qloo had no fan data for a venue (its runs are the
// headliners-only ranking, from the synthetic server's cache), both say so; a venue read for real
// that moved nothing keeps the old words. Watch's replay is answered in the browser with the
// town's own synthetic build and an edition per venue, so each venue's step holds long enough to
// read.
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
  "Linden Street Annex's fans moved no act onto the lineup, so the agent read Fort Street Ballroom; 3 acts come from that read.";
const NO_FAN =
  "Qloo had no fan data for this venue, so its ranking stays the headliners' own.";

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
    .getByRole("button", { name: "Watch the AI agent build it" })
    .click();
  // WS9: Watch's caption stands over the town on a laptop, in the poster on a phone.
  return page.getByRole("main");
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
    // Linden Street Annex was read and moved nothing for real: today's words.
    await expect(bill.getByText("+ Linden Street Annex's fans")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      bill.getByText(
        "Qloo's ranking re-sorts with this venue's fans added: no act climbs 5 places onto the lineup.",
      ),
    ).toBeVisible();
    await expect(bill.getByText("+ Fort Street Ballroom's fans")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      bill.getByText(
        "The AI agent's plan: Linden Street Annex lifted no act; try Fort Street Ballroom for both bands.",
      ),
    ).toBeVisible();
    await expect(bill.getByText(SWITCH)).toBeVisible();
  });

  test("Watch adds no switch on a trace without one, and says Qloo had no fan data for Cottonwood Social Hall", async ({
    page,
  }) => {
    const bill = await watch(page, "/", syntheticSavedBuild());
    await expect(bill.getByText("+ Cottonwood Social Hall's fans")).toBeVisible(
      { timeout: 20_000 },
    );
    await expect(
      bill.getByText(
        "The AI agent's plan: Try Cottonwood Social Hall for Mid as a third room.",
      ),
    ).toBeVisible();
    await expect(bill.getByText(NO_FAN)).toBeVisible();
    await expect(bill.getByText(/no act climbs/)).toHaveCount(0);
    await expect(bill.getByText(/so the agent read/)).toHaveCount(0);
  });

  test("How it works adds no switch on a trace without one, and says Qloo had no fan data for Cottonwood Social Hall", async ({
    page,
  }) => {
    await page.goto("/method");
    const choices = page.getByRole("region", {
      name: "The AI agent's choices",
    });
    await expect(choices).toContainText(/acts? lifted|lifted none/);
    await expect(choices).toContainText(
      "Cottonwood Social Hall: the agent read it too, but Qloo had no fan data for it.",
    );
    await expect(choices).not.toContainText("moved no act");
    await expect(choices).not.toContainText("so the agent read");
  });
});
