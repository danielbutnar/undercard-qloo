// WS10: the link preview. Each town's page has its own 1200×630 PNG, drawn with next/og from the
// saved build the page reads, never calling Qloo: the poster on a saved build, and a plain card
// with the wordmark where there is none. Locally the synthetic server reads the synthetic build.
import { expect, test, type Page } from "@playwright/test";
import { TOWNS } from "../../src/lib/towns";
import { SYNTHETIC } from "./env";

const PAGES = [
  { path: "/", image: "/opengraph-image" },
  ...TOWNS.slice(1).map((town) => ({
    path: `/towns/${town.slug}`,
    image: `/towns/${town.slug}/opengraph-image`,
  })),
];

/** The PNG's own width and height, from its signature and IHDR chunk. */
function pngSize(body: Buffer) {
  expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(body.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

/** One pixel of the PNG, decoded by the browser. */
async function pixel(page: Page, body: Buffer, x: number, y: number) {
  return page.evaluate(
    async ({ src, x, y }) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const [r, g, b] = context.getImageData(x, y, 1, 1).data;
      return { r, g, b };
    },
    { src: `data:image/png;base64,${body.toString("base64")}`, x, y },
  );
}

// Just inside the poster sheet's top-left corner: the sheet's white on the poster, the page's
// red on the plain card.
const SHEET = { x: 63, y: 108 };
const isWhite = ({ r, g, b }: { r: number; g: number; b: number }) =>
  r > 235 && g > 235 && b > 235;
const isPageRed = ({ r, g, b }: { r: number; g: number; b: number }) =>
  r > 230 && g < 90 && b < 80;

async function previewOf(page: Page, image: string) {
  const response = await page.request.get(image);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  const body = await response.body();
  expect(pngSize(body)).toEqual({ width: 1200, height: 630 });
  return pixel(page, body, SHEET.x, SHEET.y);
}

test.describe("the link preview on a saved build", () => {
  test.skip(SYNTHETIC === "empty", "needs saved builds");

  for (const { path, image } of PAGES)
    test(`${path} has a 1200×630 PNG of its poster`, async ({ page }) => {
      expect(isWhite(await previewOf(page, image))).toBe(true);
    });
});

test.describe("the link preview with no saved build", () => {
  test.skip(SYNTHETIC !== "empty", "needs a server with no saved build");

  for (const { path, image } of PAGES)
    test(`${path} has a plain 1200×630 card`, async ({ page }) => {
      expect(isPageRed(await previewOf(page, image))).toBe(true);
    });
});
