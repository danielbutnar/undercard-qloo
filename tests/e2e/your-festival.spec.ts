// M6f: "Your festival", one click from the bill. Every build request is answered in the
// browser, so this spec never starts an agent run, locally or against a deployment.
import { expect, test, type Page } from "@playwright/test";
import { SYNTHETIC } from "./env";
import { syntheticSavedBuild } from "./synthetic-build";

const NDJSON = "application/x-ndjson; charset=utf-8";
const ndjson = (events: unknown[]) =>
  events.map((event) => JSON.stringify(event)).join("\n") + "\n";

async function answerBuilds(page: Page, events: unknown[], status = 200) {
  const bodies: unknown[] = [];
  await page.route("**/api/undercard", async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status, contentType: NDJSON, body: ndjson(events) });
  });
  return bodies;
}

async function fill(
  page: Page,
  city: string,
  first: string,
  second: string,
  region = "Minnesota",
) {
  const form = page.locator("form");
  await form.getByLabel("Town", { exact: true }).fill(city);
  // M6j: the town's state or country resolves it.
  await form.getByLabel("State or country", { exact: true }).fill(region);
  await form.getByLabel("First headliner", { exact: true }).fill(first);
  await form.getByLabel("Second headliner", { exact: true }).fill(second);
  await page.getByRole("button", { name: "Draft my undercard" }).click();
}

test.describe("Your festival", () => {
  test.skip(SYNTHETIC === "empty", "the switcher needs saved builds");

  test("opens from the town switcher, and drafts a bill for the judge's own town", async ({
    page,
  }) => {
    const saved = syntheticSavedBuild();
    const bodies = await answerBuilds(page, [
      {
        type: "build",
        id: "yours-e2e",
        createdAt: saved.createdAt,
        replayed: false,
      },
      ...saved.trace.map((call) => ({ type: "call", call })),
      { type: "lineup", lineup: { ...saved.lineup, festivalId: "yours-e2e" } },
      { type: "done", calls: saved.trace.length, ms: 1500 },
    ]);
    await page.goto("/");
    const towns = page.getByRole("navigation", {
      name: "Same brief, other towns",
    });
    test.skip((await towns.count()) === 0, "no other town is on show here yet");
    await towns
      .getByRole("link", {
        name: "Or draft one for your own town and headliners",
      })
      .click();
    await expect(page).toHaveURL(/\/your-festival$/);

    await fill(page, "Duluth", "Khruangbin", "Japanese Breakfast");
    await expect(
      page
        .getByRole("region", { name: "Undercard draft" })
        .getByRole("article"),
    ).toHaveCount(10);
    await expect(
      page.getByText(/^Duluth, Minnesota · 3,000 capacity/),
    ).toBeVisible();
    expect(bodies[0]).toMatchObject({
      fresh: true,
      brief: {
        city: "Duluth",
        region: "Minnesota",
        headliners: ["Khruangbin", "Japanese Breakfast"],
      },
    });
    // No Without Qloo and no town switcher on a judge's own draft.
    await expect(
      page.getByRole("button", { name: "Without Qloo: the model's picks" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Same brief, other towns" }),
    ).toHaveCount(0);
  });

  test("checks the brief before running anything", async ({ page }) => {
    const bodies = await answerBuilds(page, []);
    await page.goto("/your-festival");
    await fill(page, "<b>", "Khruangbin", "Khruangbin");
    await expect(page.locator("form").getByRole("alert")).toContainText("town");
    expect(bodies).toHaveLength(0);
  });

  test("a headliner Qloo can't find is a designed state, with the brief kept", async ({
    page,
  }) => {
    await answerBuilds(page, [
      {
        type: "build",
        id: "yours-e2e",
        createdAt: "2026-10-17T12:00:00.000Z",
        replayed: false,
      },
      {
        type: "error",
        code: "headliner-not-found",
        message:
          "Qloo found no artist called “Nobody Atall”. Check the spelling, or try another headliner.",
      },
      { type: "done", calls: 2, ms: 900 },
    ]);
    await page.goto("/your-festival");
    await fill(page, "Duluth", "Nobody Atall", "Japanese Breakfast");
    const notice = page.getByRole("region", {
      name: "This draft couldn't be finished",
    });
    await expect(notice).toContainText("Nobody Atall");
    await notice.getByRole("button", { name: "Change the brief" }).click();
    await expect(
      page.locator("form").getByLabel("First headliner", { exact: true }),
    ).toHaveValue("Nobody Atall");
  });

  test("too few music rooms, and the daily limit, are designed states", async ({
    page,
  }) => {
    await answerBuilds(page, [
      {
        type: "build",
        id: "yours-e2e",
        createdAt: "2026-10-17T12:00:00.000Z",
        replayed: false,
      },
      {
        type: "error",
        code: "too-few-rooms",
        message:
          "Qloo lists too few live-music places in Smalltown for the agent to compare rooms. Try a larger town nearby.",
      },
      { type: "done", calls: 4, ms: 900 },
    ]);
    await page.goto("/your-festival");
    await fill(page, "Smalltown", "Khruangbin", "Japanese Breakfast");
    await expect(
      page.getByRole("region", { name: "This draft couldn't be finished" }),
    ).toContainText("too few live-music places in Smalltown");

    await page.unrouteAll();
    await answerBuilds(
      page,
      [
        {
          type: "error",
          code: "limit",
          message:
            "You've reached today's limit of 5 fresh builds from this address.",
        },
        { type: "done", calls: 0, ms: 0 },
      ],
      429,
    );
    await page.getByRole("button", { name: "Change the brief" }).click();
    await fill(page, "Duluth", "Khruangbin", "Japanese Breakfast");
    const limit = page.getByRole("region", {
      name: "This draft couldn't be finished",
    });
    await expect(limit).toContainText("today's limit");
    await expect(
      limit.getByRole("link", { name: /Back to Sagebrush Sound/ }),
    ).toHaveAttribute("href", "/");
  });
});

test.describe("Your festival's checked towns (M6k)", () => {
  test("open first, and one click drafts a town with the headliners in the form", async ({
    page,
  }) => {
    const saved = syntheticSavedBuild();
    const bodies = await answerBuilds(page, [
      {
        type: "build",
        id: "yours-e2e",
        createdAt: saved.createdAt,
        replayed: false,
      },
      ...saved.trace.map((call) => ({ type: "call", call })),
      { type: "lineup", lineup: { ...saved.lineup, festivalId: "yours-e2e" } },
      { type: "done", calls: saved.trace.length, ms: 1500 },
    ]);
    await page.goto("/your-festival");
    const towns = page.getByRole("list", {
      name: "Towns Undercard has already read",
    });
    await expect(
      towns.getByRole("button", { name: "Boise, Idaho, United States" }),
    ).toBeVisible();
    await towns.getByRole("button", { name: "Tallinn, Estonia" }).click();
    await expect(
      page
        .getByRole("region", { name: "Undercard draft" })
        .getByRole("article"),
    ).toHaveCount(10);
    await expect(
      page.getByText(/^Tallinn, Estonia · 3,000 capacity/),
    ).toBeVisible();
    expect(bodies[0]).toMatchObject({
      fresh: true,
      brief: {
        city: "Tallinn",
        region: "Estonia",
        headliners: ["Khruangbin", "Japanese Breakfast"],
      },
    });
  });
});
