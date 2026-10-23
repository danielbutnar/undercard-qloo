// WS7 part (b): each act card's small line on Qloo's split of its match, read on the server from
// the Qloo cache (here the synthetic server's seeded, invented answers), at 1440x900 and 390x844.
// The line comes with the page's HTML, so the browser asks nothing for it and nothing reaches
// Qloo; it shows only for the saved lineup with every venue on; it never says Qloo confirms the
// venue a card credits; and the phone doesn't scroll sideways. Shots go to .design/shots/.
import { expect, test, type Page } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.skip(SYNTHETIC === "empty", "needs a saved build");

const SHARE = "(?:\\d+%|under 1%)";
const LINE = new RegExp(
  `^(?:With this fee range's venues together, )?Qloo traces ${SHARE} of this act's match to fans of .+?(?:(?:, ${SHARE} to fans of .+?)* and ${SHARE} to fans of .+?)?\\.$`,
);
const NEVER =
  /confirm|agree|prove|backs?\b|verif|\balso\b|\btoo\b|as well|credit/i;
const shares = (line: string) =>
  [...line.matchAll(/(\d+)%|under 1%/g)].map((m) =>
    m[1] ? Number(m[1]) : 0.5,
  );

const bill = (page: Page) =>
  page.getByRole("region", { name: "Undercard draft" });
const rooms = (page: Page) =>
  page.getByRole("region", {
    name: "Boise venues whose fans shaped this lineup",
  });

async function openCard(page: Page, name: string) {
  await bill(page).getByRole("button", { name, exact: true }).first().click();
  return page
    .getByRole("region", { name: "Act card" })
    .getByRole("article", { name, exact: true });
}

for (const view of [
  { label: "1440x900", width: 1440, height: 900, phone: false },
  { label: "390x844", width: 390, height: 844, phone: true },
])
  test.describe(`at ${view.label}`, () => {
    test.use({ viewport: { width: view.width, height: view.height } });

    test("a mid-size and an opening act's card each show Qloo's split, and nothing reaches Qloo", async ({
      page,
    }) => {
      const asked: string[] = [];
      page.on("request", (request) => asked.push(request.url()));
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);

      for (const name of ["Marisol Vey", "Low Bench Choir"]) {
        const card = await openCard(page, name);
        const line = card.locator(".card-split");
        await expect(line).toBeVisible();
        // innerText reads only the form the viewport shows.
        const text = (await line.innerText()).trim();
        expect(text).toMatch(LINE);
        expect(text).not.toMatch(NEVER);
        const parts = shares(text);
        expect(parts.length).toBeGreaterThanOrEqual(2);
        expect([...parts].sort((a, b) => b - a)).toEqual(parts);
        // On a phone a venue goes by its mark, as the card's venue line does.
        if (view.phone) {
          expect(text).toContain("FSB");
          expect(text).not.toContain("Fort Street Ballroom");
        } else expect(text).toContain("Fort Street Ballroom");
        // After the rule, outside the three checks.
        await expect(
          card.getByRole("list", { name: "The three checks it passed" }),
        ).not.toContainText("Qloo traces");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          ),
        ).toBeLessThanOrEqual(0);
        if (name === "Marisol Vey") {
          // On a laptop the card scrolls inside the scene: the line is brought into view first.
          await line.scrollIntoViewIfNeeded();
          const shot = { animations: "disabled", caret: "hide" } as const;
          await page.screenshot({
            path: `.design/shots/act-card-split-${view.label}.png`,
            ...shot,
          });
          await card.screenshot({
            path: `.design/shots/act-card-split-card-${view.label}.png`,
            ...shot,
          });
        }
      }

      // The line came with the page: no route was asked for it, and nothing went to Qloo's API.
      expect(
        asked.filter((url) => url.includes("hackathon.api.qloo.com")),
      ).toEqual([]);
      expect(
        asked.filter((url) => new URL(url).pathname.startsWith("/api/")),
      ).toEqual([]);
    });
  });

test.describe("at 1440x900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a venue switched off takes the line away until every venue is back on", async ({
    page,
  }) => {
    await page.goto("/");
    const toggle = rooms(page).getByRole("button", {
      name: /^Cottonwood Social Hall: on/,
    });
    await expect(toggle).toBeEnabled({ timeout: 15_000 });
    await toggle.click();
    const card = await openCard(page, "Marisol Vey");
    await expect(card).toContainText("Turn every venue back on");
    await expect(card.locator(".card-split")).toHaveCount(0);
    // Closed first: a second click on an open act closes its card.
    await card.getByRole("button", { name: "Close the card" }).click();
    await expect(card).toHaveCount(0);

    await rooms(page).getByRole("button", { name: "All venues on" }).click();
    await expect(
      (await openCard(page, "Marisol Vey")).locator(".card-split"),
    ).toBeVisible();
  });
});

test("a plain fetch of / carries each act's line in the server's HTML", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  expect(
    (html.match(/Qloo traces \d+% of this act/g) ?? []).length,
  ).toBeGreaterThanOrEqual(10);
  expect(html).toContain("With this fee range");
  expect(html).not.toMatch(/Qloo (confirms|agrees|proves|backs|verifies)/);
});
