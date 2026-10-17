// Devpost gallery stills from the live demo, at 3:2 (Devpost's ratio for the project thumbnail;
// it states none for the gallery), 2400x1600. They show real Qloo results, so they go to
// .design/submission/, which is gitignored. Only replays the saved build: nothing here presses
// "Run the agent live instead". The refill makes one Qloo call, as the live e2e does.
// Run from video/: node scripts/gallery.ts <base-url>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import type { Page } from "playwright";

const BASE = process.argv[2] ?? "https://undercard-daniel-51ed.vercel.app";
const OUT = "../.design/submission";
const VIEWPORT = { width: 1500, height: 1000 };

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: VIEWPORT,
  deviceScaleFactor: 1.6,
  reducedMotion: "reduce",
});

const bill = (p: Page) => p.getByRole("region", { name: "Undercard draft" });
const mid = (p: Page) => bill(p).getByRole("region", { name: /^Mid/ });
const trace = (p: Page) => p.getByRole("list", { name: "Qloo calls" });

async function shot(name: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    animations: "disabled",
    caret: "hide",
  });
  console.log(`  ${name}.png`);
}

try {
  await page.goto(BASE, { waitUntil: "load" });
  await bill(page).getByRole("article").nth(9).waitFor();
  await shot("gallery-1-first-screen");

  await page.getByRole("button", { name: "Watch how it picked these acts" }).click();
  await page
    .getByText(/^Replayed the build saved/)
    .waitFor({ timeout: 30_000 });
  await trace(page)
    .getByText(/^Agent:/)
    .first()
    .scrollIntoViewIfNeeded();
  await shot("gallery-2-replay");

  await mid(page)
    .getByRole("article")
    .first()
    .getByRole("button")
    .first()
    .click();
  const card = page.getByRole("region", { name: "Act card" });
  await card.waitFor();
  await shot("gallery-3-act-card");

  await card.getByRole("button", { name: "Unavailable" }).click();
  const refill = trace(page)
    .getByText(/Refill: /)
    .last();
  await refill.waitFor({ timeout: 60_000 });
  await refill.scrollIntoViewIfNeeded();
  await shot("gallery-4-refill");

  await page
    .getByRole("button", { name: "Without Qloo: an AI model's picks alone" })
    .click();
  await page
    .getByRole("region", { name: "Without Qloo: an AI model's picks alone" })
    .getByRole("article")
    .first()
    .waitFor({ timeout: 60_000 });
  await shot("gallery-5-without-qloo");

  const svg = readFileSync("../docs/architecture.svg", "utf8");
  await page.setContent(
    `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders:wght@800&family=Libre+Franklin:wght@400;600&display=swap"><style>html,body{margin:0}</style></head><body>${svg}</body></html>`,
    { waitUntil: "networkidle" },
  );
  await shot("gallery-6-architecture");
} finally {
  await browser.close();
}
