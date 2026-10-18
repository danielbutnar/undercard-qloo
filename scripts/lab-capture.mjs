#!/usr/bin/env node
// The design round's lab captures (TASKS.md "Design round", step 2). For each direction: the first
// screen at 1440x810 and at 390 wide (the phone's first screen and the full page), and a clip of
// the agent building the lineup after Watch, from the real replay of the saved Boise build (the
// replay makes no Qloo or Claude call). "live" shoots the current first screen the same way.
// Needs the lab's dev server: `pnpm dev --port 3200` (.claude/launch.json "undercard-lab").
//   node scripts/lab-capture.mjs [slug ...]        default: every direction, then live
// Writes .design/lab (git-ignored, never committed): <slug>-1440.png, <slug>-390.png,
// <slug>-390-full.png, <slug>-build.webm and <slug>-build.json (when Watch was pressed and the
// build ended, in seconds into the clip, for the lab page's player).
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.LAB_URL ?? "http://localhost:3200";
const OUT = join(".design", "lab");
const ALL = ["chart", "desk", "flap", "marquee", "board", "tree", "live"];
const WATCH = "Watch how it picked these acts";
const VIDEO = { width: 1440, height: 810 };
const PHONE = { width: 390, height: 844 };

const args = process.argv.slice(2);
const onlyFrames = args.includes("--frames");
const named = args.filter((arg) => !arg.startsWith("--"));
const slugs = named.length ? named : ALL;
const url = (slug) => `${BASE}${slug === "live" ? "/" : `/lab/${slug}`}`;
mkdirSync(OUT, { recursive: true });

async function ready(page, slug) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  if (slug !== "live") await page.locator("[data-lab-phase='idle']").waitFor();
  await page.waitForTimeout(600);
}

const watchButton = (page) =>
  page
    .getByRole("button", { name: WATCH, exact: true })
    .filter({ visible: true })
    .first();

async function stills(browser, slug) {
  const page = await browser.newPage({ viewport: VIDEO });
  await page.goto(url(slug), { waitUntil: "load" });
  await ready(page, slug);
  await page.screenshot({ path: join(OUT, `${slug}-1440.png`), caret: "hide" });
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  const watchTop = await watchButton(page)
    .boundingBox()
    .then((box) => (box ? Math.round(box.y) : null));
  await page.screenshot({ path: join(OUT, `${slug}-390.png`), caret: "hide" });
  await page.screenshot({
    path: join(OUT, `${slug}-390-full.png`),
    fullPage: true,
    caret: "hide",
  });
  await page.close();
  return { overflow, watchTop };
}

async function clip(browser, slug) {
  const dir = mkdtempSync(join(tmpdir(), "lab-clip-"));
  const context = await browser.newContext({
    viewport: VIDEO,
    recordVideo: { dir, size: VIDEO },
  });
  const page = await context.newPage();
  const opened = Date.now();
  await page.goto(url(slug), { waitUntil: "load" });
  await ready(page, slug);
  await page.waitForTimeout(700);
  const pressed = (Date.now() - opened) / 1000;
  await watchButton(page).click();
  // Locally the replay first reads seven cached Qloo answers from Upstash one by one (about 4 s
  // from Bucharest; milliseconds on Vercel), so the clip starts 1.5 s before the first step.
  let climbing = pressed;
  if (slug === "live") await page.waitForTimeout(14_500);
  else {
    await page
      .locator("[data-lab-phase='climbing']")
      .waitFor({ timeout: 30_000 });
    climbing = (Date.now() - opened) / 1000;
    await page.locator("[data-lab-phase='done']").waitFor({ timeout: 30_000 });
  }
  await page.waitForTimeout(1_800);
  const ended = (Date.now() - opened) / 1000;
  const video = page.video();
  await context.close();
  renameSync(await video.path(), join(OUT, `${slug}-build.webm`));
  rmSync(dir, { recursive: true, force: true });
  const start = Math.max(0, pressed - 0.8, climbing - 1.5);
  const round = (value) => Number(value.toFixed(2));
  writeFileSync(
    join(OUT, `${slug}-build.json`),
    `${JSON.stringify({ start: round(start), end: round(ended), pressed: round(pressed), firstStep: round(climbing) })}\n`,
  );
  return { seconds: ended - start, wait: climbing - pressed };
}

// --frames: stills every 1.5 s through the build, to review the motion without a video player.
async function frames(browser, slug) {
  const page = await browser.newPage({ viewport: VIDEO });
  await page.goto(url(slug), { waitUntil: "load" });
  await ready(page, slug);
  await watchButton(page).click();
  await page
    .locator("[data-lab-phase='climbing']")
    .waitFor({ timeout: 30_000 });
  for (let n = 1; n <= 9; n++) {
    await page.screenshot({
      path: join(OUT, `${slug}-frame-${n}.png`),
      caret: "hide",
    });
    if (
      (await page.getAttribute("[data-lab-phase]", "data-lab-phase")) === "done"
    )
      break;
    await page.waitForTimeout(1_500);
  }
  await page.close();
}

const browser = await chromium.launch();
try {
  for (const slug of slugs) {
    if (onlyFrames) {
      await frames(browser, slug);
      console.log(`${slug}: frames done`);
      continue;
    }
    const { overflow, watchTop } = await stills(browser, slug);
    const { seconds, wait } = await clip(browser, slug);
    console.log(
      `${slug}: stills done${overflow > 0 ? `, ${overflow}px sideways scroll at 390` : ""}; Watch at ${watchTop ?? "?"}px on a phone; clip ${seconds.toFixed(1)} s (first step ${wait.toFixed(1)} s after Watch)`,
    );
  }
} finally {
  await browser.close();
}
