// WS12 item 6: "Download the poster" beside Export CSV downloads the poster on screen as a
// print-size PNG (1800×2400), drawn by next/og on the server, under the demo festival's file
// name. Daniel's bounds for Vercel: under 10 s and a few MB. It calls no Qloo and no model, so it
// runs against a deployment too, where its timing is the one that counts.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  test.describe(`Download the poster at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("downloads the demo's poster as a print-size PNG in seconds", async ({
      page,
    }) => {
      // A dev server compiles the route on its first request: not part of the poster's time.
      await page.request.post("/api/poster", { data: {} });
      await page.goto("/");
      const button = page.getByRole("button", { name: "Download the poster" });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();

      const started = Date.now();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        button.click(),
      ]);
      const body = readFileSync(await download.path());
      const seconds = (Date.now() - started) / 1000;

      expect(download.suggestedFilename()).toBe(
        "sagebrush-sound-fictional-demo-festival-poster.png",
      );
      expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect([body.readUInt32BE(16), body.readUInt32BE(20)]).toEqual([
        1800, 2400,
      ]);
      expect(body.length).toBeLessThan(4_000_000);
      expect(seconds).toBeLessThan(10);
      await expect(button).toHaveText("Download the poster");
      await expect(button).toBeEnabled();
    });
  });
