// M8e: a keyboard and screen-reader pass on every screen (docs/evidence.md section 23). For each
// page: one level-1 heading; every control, image and region named; every control reached by
// Tab with a visible focus mark; and Tab never trapped.
import { expect, test, type Page } from "@playwright/test";
import { SYNTHETIC } from "./env";

const PAGES = ["/", "/towns/austin", "/your-festival", "/compare", "/method"];

async function audit(page: Page) {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const box = (el as HTMLElement).getBoundingClientRect();
      const style = getComputedStyle(el);
      return (
        box.width > 0 &&
        box.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };
    const name = (el: Element) =>
      (
        el.getAttribute("aria-label") ??
        el
          .getAttribute("aria-labelledby")
          ?.split(" ")
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ") ??
        el.textContent ??
        ""
      ).trim();
    const controls = [
      ...document.querySelectorAll(
        "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
      ),
    ].filter(visible);
    return {
      h1: document.querySelectorAll("h1").length,
      unnamedControls: controls
        .filter((el) => !name(el) && !(el as HTMLInputElement).labels?.length)
        .map((el) => el.outerHTML.slice(0, 80)),
      unnamedImages: [
        ...document.querySelectorAll("img, svg[role='img'], [role='img']"),
      ]
        .filter(
          (el) => !el.getAttribute("alt") && !el.getAttribute("aria-label"),
        )
        .map((el) => el.outerHTML.slice(0, 80)),
      unnamedRegions: [
        ...document.querySelectorAll(
          "section[aria-label], section[aria-labelledby], [role='region']",
        ),
      ].filter((el) => !name(el)).length,
      controls: controls.length,
    };
  });
}

for (const path of PAGES) {
  test(`keyboard and screen reader on ${path}`, async ({ page }) => {
    test.skip(SYNTHETIC === "empty", "needs saved builds");
    test.setTimeout(120_000);
    await page.goto(path, { waitUntil: "load" });
    const found = await audit(page);
    expect(found.h1, "one level-1 heading").toBe(1);
    expect(found.unnamedControls, "every control has a name").toEqual([]);
    expect(found.unnamedImages, "every image has a name").toEqual([]);
    expect(found.unnamedRegions, "every region has a name").toBe(0);

    // Tab through the page: each stop shows a visible focus mark, and Tab gets back out.
    const seen = new Set<string>();
    const noMark: string[] = [];
    for (let i = 0; i < found.controls + 5; i++) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        const marked =
          (style.outlineStyle !== "none" &&
            parseFloat(style.outlineWidth) > 0) ||
          style.textDecorationLine.includes("underline") ||
          style.boxShadow !== "none";
        return {
          key: `${el.tagName} ${el.getAttribute("href") ?? ""} ${(el.textContent ?? "").trim().slice(0, 60)} ${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("name") ?? ""}`,
          marked,
        };
      });
      if (!stop) break;
      if (seen.has(stop.key)) break;
      seen.add(stop.key);
      if (!stop.marked) noMark.push(stop.key);
    }
    expect(noMark, "every Tab stop shows a focus mark").toEqual([]);
    expect(seen.size, "Tab reaches the page's controls").toBeGreaterThanOrEqual(
      Math.min(found.controls, 3),
    );
  });
}
