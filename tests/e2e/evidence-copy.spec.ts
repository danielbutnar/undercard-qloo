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
  ];
  expect(headings.filter((heading) => ORDER.includes(heading))).toEqual(ORDER);
  // Daniel's brief of 2026-10-22, item 6: the testers' placeholder once, in What real people
  // said; the copy of it at the foot is gone.
  expect(headings).not.toContain("Still to come");
  // The second batch, item 4: every section the page cites was checked against the record;
  // the line names each with no bar (evidence 1, 5 and 8) and the one that describes the code
  // (22), each linked to its own heading.
  const lead = page.locator(".method-lead .compare-what");
  await expect(lead).toHaveText(
    "Every test below that has a bar had it written before it ran; evidence " +
      "1, 5 and 8 have none, and evidence 22 describes the code. The full " +
      "record of each is in docs/evidence.md.",
  );
  const named = await lead
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")!.split("#")[1]),
    );
  expect(named.map((anchor) => anchor.split("-")[0])).toEqual([
    "1",
    "5",
    "8",
    "22",
  ]);
  for (const anchor of named) expect(ANCHORS.has(anchor)).toBe(true);
  // The location bullet says what evidence 6 tested, and what it didn't.
  await expect(
    page.getByRole("region", { name: "What the no-gos taught" }),
  ).toContainText(
    "Qloo's location data gave a usable local reading for at most 7 of the " +
      "10 acts the venues picked (evidence 6), so a town's taste enters the " +
      "ranking through its venues' fans; drafting from Qloo's location " +
      "signal itself wasn't tested.",
  );
  // A result with a go or no-go chip doesn't repeat the chip's word in what it shows.
  const repeated = await page
    .locator("td.evidence-result")
    .evaluateAll((cells) =>
      cells.flatMap((cell) => {
        const chip = cell.querySelector(".result-chip")?.textContent?.trim();
        const shown = cell.lastElementChild?.textContent?.trim() ?? "";
        return chip && shown.toLowerCase().startsWith(chip) ? [shown] : [];
      }),
    );
  expect(repeated).toEqual([]);
  // Item 7, scope: whose fee ranges these are, and the local acts Undercard leaves out.
  await expect(page.getByRole("region", { name: "Evidence" })).toContainText(
    // Daniel, 2026-10-23 (WS6, version A): the buyer sets it, fixed in this demo.
    "A fee range is a range of Qloo popularity the buyer sets, fixed to " +
      "Sagebrush Sound's in this demo. It stands in for a fee because no fee " +
      "data exists.",
  );
  // The second batch, item 2: the first limit says the same.
  await expect(
    page
      .getByRole("region", { name: "What these numbers don't establish" })
      .getByRole("listitem")
      .first(),
  ).toHaveText(
    "That the acts would sell tickets, take the slot or fit the budget: the " +
      "fee ranges are popularity ranges the buyer sets, not fees.",
  );
  await expect(
    page
      .getByRole("region", { name: "What these numbers don't establish" })
      .getByRole("listitem")
      .filter({ hasText: "local acts" }),
  ).toHaveText(
    "That the lineup includes local acts: Treefort books many, and evidence " +
      "2 infers that most of its acts sit below the opening range's popularity " +
      "floor, so Undercard drafts the touring slots and leaves local ones to " +
      "the buyer.",
  );
  await expect(page.locator("td.evidence-result .result-chip")).toHaveCount(3);
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

  await expect(page.getByText(/^\[Still to come: /)).toHaveCount(1);
  // Corrections 2 and 3 (plan.md): the block holds the approved sentences and nothing else.
  await expect(
    page.getByRole("region", {
      name: "What real people said, and what changed",
    }),
  ).toHaveText(
    "What real people said, and what changed" +
      "The first person to see an early design couldn't tell what it was for. " +
      "The design was rebuilt; the current one is a chart of climbing acts, " +
      "each leading with its climb and the venue behind it." +
      "[Still to come: this week's test with real people, against the bar " +
      "written first (evidence 32): how many, what they said within sixty " +
      "seconds, and what changed.]",
  );
});
