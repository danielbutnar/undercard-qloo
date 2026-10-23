// WS10: the link preview. Each town's page has its own 1200×630 PNG, drawn with next/og from the
// saved build the page reads, never calling Qloo: the poster on a saved build, and a plain card
// with the wordmark where there is none; its head names that PNG, with og:title, og:description
// and Twitter's large-image card. Locally the synthetic server reads the synthetic build.
import { expect, test, type Page } from "@playwright/test";
import {
  shareAlt,
  shareMetadata,
} from "../../src/components/share/share-words";
import { TOWNS } from "../../src/lib/towns";
import { SYNTHETIC } from "./env";

const PAGES = TOWNS.map((town) => ({
  festival: town.festival,
  home: town.slug === "boise",
  path: town.slug === "boise" ? "/" : `/towns/${town.slug}`,
  image:
    town.slug === "boise"
      ? "/opengraph-image"
      : `/towns/${town.slug}/opengraph-image`,
}));

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

test.describe("the link preview's tags", () => {
  for (const { festival, home, path, image } of PAGES)
    test(`${path} names its title, description, card and picture`, async ({
      page,
    }) => {
      test.skip(
        SYNTHETIC === "empty" && !home,
        "a town with no saved build isn't on show",
      );
      await page.goto(path);
      const tag = (key: string) =>
        page
          .locator(`meta[property="${key}"], meta[name="${key}"]`)
          .first()
          .getAttribute("content");
      const { openGraph } = shareMetadata(festival);
      expect(await tag("og:title")).toBe(openGraph.title);
      expect(await tag("og:description")).toBe(openGraph.description);
      expect(await tag("twitter:card")).toBe("summary_large_image");
      expect(await tag("twitter:title")).toBe(openGraph.title);
      expect(await tag("twitter:description")).toBe(openGraph.description);
      // The picture the tags name is the page's own route, 1200×630.
      const picture = new URL((await tag("og:image"))!);
      expect(picture.pathname).toBe(image);
      expect(await tag("twitter:image")).toBe(picture.href);
      expect(await tag("og:image:type")).toBe("image/png");
      expect(await tag("og:image:width")).toBe("1200");
      expect(await tag("og:image:height")).toBe("630");
      expect(await tag("og:image:alt")).toBe(shareAlt(home ? festival : null));
      await previewOf(page, picture.pathname + picture.search);
    });

  test("a link-preview crawler finds them in the page's first HTML", async ({
    request,
  }) => {
    const html = await (
      await request.get("/", { headers: { "user-agent": "Twitterbot/1.0" } })
    ).text();
    const head = html.slice(0, html.indexOf("</head>"));
    // As React writes an attribute: an apostrophe is escaped.
    const escaped = (text: string) => text.replaceAll("'", "&#x27;");
    const { openGraph } = shareMetadata(PAGES[0].festival);
    expect(head).toContain(
      `<meta property="og:title" content="${escaped(openGraph.title)}"`,
    );
    expect(head).toContain(
      `<meta property="og:description" content="${escaped(openGraph.description)}"`,
    );
    expect(head).toMatch(
      /<meta property="og:image" content="[^"]*\/opengraph-image[^"]*"/,
    );
    expect(head).toContain(
      '<meta name="twitter:card" content="summary_large_image"',
    );
  });
});
