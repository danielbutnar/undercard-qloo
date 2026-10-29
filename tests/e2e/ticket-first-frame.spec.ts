// WS18 (the /method overflow): at 390x844 How it works scrolled sideways for about 250 ms after
// load, and the full e2e's footer check failed whenever it measured in that window. Until the
// page's scripts run, nothing holds the door check's ticket back (use-reveal.ts marks it as
// waiting only once they do), so its stamps land from their first frame, at 1.7 times their size:
// the genres stamp reached 12 px past the screen's right edge, on the landing's ticket too. Here
// the scripts never run, and every animation is held at its first frame, that window's widest
// moment.
import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 375, height: 812 },
  { width: 360, height: 780 },
])
  test.describe(`at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("the door check's stamps, as they land, keep the page inside the screen", async ({
      page,
    }) => {
      // The server's HTML on its own: no script of the page's runs.
      await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, (route) =>
        route.abort(),
      );
      for (const path of ["/method", "/"]) {
        await page.goto(path, { waitUntil: "load" });
        const first = await page.evaluate(() => {
          const animations = document.getAnimations();
          for (const animation of animations) {
            animation.pause();
            animation.currentTime = 0;
          }
          const stamps = animations.filter((animation) => {
            const target =
              animation.effect instanceof KeyframeEffect
                ? animation.effect.target
                : null;
            return target?.classList.contains("stamp") ?? false;
          });
          return {
            stamps: stamps.length,
            over: document.documentElement.scrollWidth - window.innerWidth,
          };
        });
        // The ticket's three stamps are landing,
        expect(first.stamps, path).toBe(3);
        // and none of them reaches past the screen's edge.
        expect(first.over, path).toBeLessThanOrEqual(0);
      }
    });
  });
