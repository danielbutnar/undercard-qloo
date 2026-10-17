// Captures the demo path in scripts/steps.ts as 2x stills plus element boxes, for the 60 fps edit.
// Run from video/ with the app running on seeded data: pnpm run capture
// Base URL: the first argument, else CAPTURE_URL, else http://localhost:3000. Use the deployed preview for the final cut.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import type { Locator } from "playwright";
import { steps, VIEWPORT } from "./steps.ts";

type Box = { x: number; y: number; width: number; height: number };
const BASE =
  process.argv[2] ?? process.env.CAPTURE_URL ?? "http://localhost:3000";
const OUT = "public/capture";

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
const page = await context.newPage();
const manifest: { viewport: typeof VIEWPORT; steps: object[] } = {
  viewport: VIEWPORT,
  steps: [],
};

async function still(name: string): Promise<string> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    animations: "disabled",
    caret: "hide",
  });
  return `capture/${name}.png`;
}

async function boxOf(locator: Locator | undefined): Promise<Box | null> {
  const box = locator ? await locator.boundingBox() : null;
  return (
    box && {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    }
  );
}

try {
  for (const step of steps) {
    if (step.url)
      await page.goto(new URL(step.url, BASE).href, { waitUntil: "load" });
    const target = step.target?.(page);
    if (target) {
      await target.waitFor({ state: "visible", timeout: 20_000 });
      await target.scrollIntoViewIfNeeded();
    }
    const action = step.action ?? (target ? "click" : "none");
    const targetBox = await boxOf(target);
    const before = await still(`${step.id}-before`);
    const typing: string[] = [];
    if (action === "type" && target) {
      const text = step.text ?? "";
      const parts = Math.max(1, Math.min(6, Math.ceil(text.length / 4)));
      for (let i = 1; i <= parts; i++) {
        await target.pressSequentially(
          text.slice(
            Math.floor(((i - 1) * text.length) / parts),
            Math.floor((i * text.length) / parts),
          ),
        );
        typing.push(await still(`${step.id}-type-${i}`));
      }
      if (step.submit) await target.press("Enter");
    }
    if (action === "click" && target) await target.click();
    if (action === "hover" && target) await target.hover();
    const after: string[] = [];
    const frames = Math.max(1, step.frames ?? 1);
    for (let i = 1; i < frames; i++) {
      await page.waitForTimeout(step.frameEveryMs ?? 400);
      after.push(await still(`${step.id}-after-${i}`));
    }
    if (step.until)
      await step.until(page).waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(350);
    const focusBox = (await boxOf(step.focus?.(page))) ?? targetBox;
    after.push(await still(`${step.id}-after-${frames}`));
    manifest.steps.push({
      id: step.id,
      action,
      before,
      typing,
      after,
      target: targetBox,
      focus: focusBox,
    });
    console.log(`  ${step.id}: ${1 + typing.length + after.length} stills`);
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Captured ${steps.length} steps from ${BASE} into video/${OUT}.`);
