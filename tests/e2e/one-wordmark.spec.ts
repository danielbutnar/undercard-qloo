// WS12 item 7: one product across pages. Every page's top bar carries the landing's wordmark,
// set the same way (face, size, case, spacing), with no older mark beside it.
import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  "/method",
  "/method/evidence",
  "/compare",
  "/your-festival",
  "/shortlist",
];

async function wordmark(page: Page) {
  const home = page
    .getByRole("banner")
    .getByRole("link", { name: "Undercard, back to Sagebrush Sound" });
  await expect(home).toBeVisible();
  return home.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      text: element.textContent,
      marks: element.querySelectorAll("svg").length,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      textTransform: style.textTransform,
      letterSpacing: style.letterSpacing,
    };
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  test.describe(`one wordmark at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("every page's top bar sets the landing's wordmark", async ({
      page,
    }) => {
      await page.goto("/");
      const landing = await wordmark(page);
      expect(landing.marks).toBe(0);
      for (const path of PAGES) {
        await page.goto(path);
        expect(await wordmark(page), path).toEqual(landing);
      }
    });
  });
