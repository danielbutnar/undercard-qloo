// Judging-window resilience (plan.md item 2, prompt A part 2): when a judge's live run ends
// because Qloo is busy, the planner's model call failed, or the day's per-IP or global cap is
// reached, the notice says so in one sentence and offers the checked towns in the same country
// to replay; with none there, it offers Sagebrush Sound's replay. The builds are stubbed, so no
// Qloo or Claude call is made.
import { expect, test, type Page } from "@playwright/test";

const NDJSON = "application/x-ndjson";
const ndjson = (events: unknown[]) =>
  events.map((event) => JSON.stringify(event)).join("\n") + "\n";

const STATES = [
  {
    name: "the per-IP cap",
    code: "limit",
    status: 429,
    message:
      "You've used today's 5 fresh builds from this network. The saved build still replays instantly. Try again tomorrow (UTC).",
  },
  {
    name: "the global cap",
    code: "limit",
    status: 429,
    message:
      "Undercard has reached today's limit of 60 fresh builds for everyone. The saved build still replays instantly. Try again tomorrow (UTC).",
  },
  {
    name: "a busy Qloo",
    code: "qloo-busy",
    status: 200,
    message: "Qloo is busy right now. Try again in a minute.",
  },
  {
    name: "a failed planner call",
    code: "planner-failed",
    status: 200,
    message:
      "The planning model is unavailable right now. Try again in a minute.",
  },
];

async function runInto(
  page: Page,
  state: (typeof STATES)[number],
  region: string,
) {
  await page.route("**/api/undercard", (route) =>
    route.fulfill({
      status: state.status,
      contentType: NDJSON,
      body: ndjson([
        { type: "error", code: state.code, message: state.message },
        { type: "done", calls: 0, ms: 0 },
      ]),
    }),
  );
  await page.goto("/your-festival");
  const form = page.locator("form");
  await form.getByLabel("Town", { exact: true }).fill("Duluth");
  await form.getByLabel("State or country", { exact: true }).fill(region);
  await form.getByLabel("First headliner", { exact: true }).fill("Khruangbin");
  await form
    .getByLabel("Second headliner", { exact: true })
    .fill("Japanese Breakfast");
  await page.getByRole("button", { name: "Draft my undercard" }).click();
  return page.getByRole("region", { name: "This draft couldn't be finished" });
}

for (const state of STATES) {
  test(`${state.name}: the notice says so and offers the country's checked towns to replay`, async ({
    page,
  }) => {
    const notice = await runInto(page, state, "Minnesota");
    await expect(notice).toContainText(state.message);
    const towns = notice.getByRole("list", {
      name: "Towns Undercard has already read in the United States",
    });
    await expect(towns).toBeVisible();
    await expect(towns.getByRole("button").first()).toBeVisible();
  });

  test(`${state.name}: with no checked town in that country, it offers Sagebrush Sound's replay`, async ({
    page,
  }) => {
    const notice = await runInto(page, state, "Japan");
    await expect(notice).toContainText(state.message);
    await expect(notice.getByRole("list")).toHaveCount(0);
    await expect(
      notice.getByRole("link", { name: /Back to Sagebrush Sound/ }),
    ).toHaveAttribute("href", "/");
  });
}
