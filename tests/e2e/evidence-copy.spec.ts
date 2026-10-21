// Plan.md item 10 (the review's section 9c, with Daniel's corrections): the evidence page reads
// in this order, opens on its three summary lines, links every "evidence N" label to its section
// of docs/evidence.md, and shows a placeholder where a result is still to come.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const ANCHORS = new Set(
  readFileSync("docs/evidence.md", "utf8")
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) =>
      line
        .slice(3)
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s/g, "-"),
    ),
);

test("the evidence page reads in the plan's order, every label linked", async ({
  page,
}) => {
  await page.goto("/method/evidence");
  const headings = (
    await page.getByRole("heading", { level: 2 }).allTextContents()
  ).map((text) => text.trim());
  const ORDER = [
    "In fifteen seconds",
    "What the no-gos taught",
    "What real people said, and what changed",
    "Five objections, answered",
    "What these numbers don't establish",
    "Still to come",
  ];
  expect(headings.filter((heading) => ORDER.includes(heading))).toEqual(ORDER);
  for (const title of ["Does the idea hold?", "Does the product work?"])
    await expect(page.getByRole("table", { name: title })).toBeVisible();

  const lines = page
    .getByRole("region", { name: "Evidence" })
    .getByRole("listitem");
  for (const [index, word] of ["Shown", "Partly shown", "Not shown"].entries())
    await expect(lines.nth(index)).toContainText(`${word}:`);

  const labels = page.getByRole("link", { name: /^evidence \d+$/ });
  expect(await labels.count()).toBeGreaterThan(20);
  for (const link of await labels.all()) {
    const href = (await link.getAttribute("href"))!;
    expect(href).toMatch(/docs\/evidence\.md#/);
    expect(ANCHORS.has(href.split("#")[1])).toBe(true);
  }

  await expect(page.getByText(/^\[Still to come: /).first()).toBeVisible();
  // Corrections 2 and 3 (plan.md): neither reply is quoted or described.
});
