// WS2 (a): How it works' video slot. While DEMO_VIDEO_URL is unset the page has no slot at all,
// heading included; a YouTube link shows a click-to-play facade, and only the press loads the
// youtube-nocookie.com player (M9c: nothing loads until it's played). The facade is checked on
// /lab/video-slot, which only `next dev` serves; YouTube's hosts answer locally, never the network.
import { expect, test } from "@playwright/test";
import { LAB_VIDEO_URL } from "../../src/lib/lab";
import { DEMO_VIDEO_URL } from "../../src/lib/method";

const ID = /[?&]v=([\w-]{11})/.exec(LAB_VIDEO_URL)![1];
const YOUTUBE =
  /^https:\/\/([a-z0-9-]+\.)*(youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|googlevideo\.com)\//;
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test("How it works shows no video slot, heading included, while the video isn't published", async ({
  page,
}) => {
  test.skip(DEMO_VIDEO_URL !== null, "the demo video is published");
  await page.goto("/method");
  await expect(
    page.getByRole("img", { name: /How Undercard drafts a lineup/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "The demo video" }),
  ).toHaveCount(0);
  await expect(page.getByText(/demo video/i)).toHaveCount(0);
  await expect(page.locator("video, iframe")).toHaveCount(0);
});

test("a YouTube link shows its thumbnail and a play button, and only the press loads the player", async ({
  page,
}) => {
  const asked: string[] = [];
  await page.route(YOUTUBE, (route) => {
    asked.push(route.request().url());
    return route.request().resourceType() === "image"
      ? route.fulfill({ status: 200, contentType: "image/png", body: PIXEL })
      : route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><title>player</title>",
        });
  });
  const response = await page.goto("/lab/video-slot");
  test.skip(response?.status() === 404, "the lab runs only under next dev");

  const slot = page.getByRole("region", { name: "The demo video" });
  const play = slot.getByRole("button", { name: "Play the demo video" });
  await expect(play).toBeVisible();
  await expect(play.locator("img")).toHaveAttribute(
    "src",
    `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
  );
  // Before the press: the thumbnail only, no iframe, no player and no other YouTube request.
  await page.waitForTimeout(1000);
  await expect(page.locator("iframe, video")).toHaveCount(0);
  expect(
    asked.filter((url) => !url.startsWith("https://i.ytimg.com/vi/")),
  ).toEqual([]);

  await play.click();
  const player = slot.locator("iframe");
  await expect(player).toHaveAttribute(
    "src",
    new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${ID}\\?`),
  );
  await expect(player).toHaveAttribute("title", /demo video/i);
  await expect
    .poll(() =>
      asked.some((url) =>
        url.startsWith(`https://www.youtube-nocookie.com/embed/${ID}`),
      ),
    )
    .toBe(true);
});
