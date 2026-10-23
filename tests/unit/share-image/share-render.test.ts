// WS10, step 2: the link preview as the routes serve it: a 1200×630 PNG drawn with next/og from
// the festival's latest saved build, read from the build store only, never from Qloo. With no
// saved build, the plain card. Invented acts and venues (tests/e2e/synthetic-build.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INNER_H,
  posterLayout,
  SHARE_COLORS,
} from "@/components/share/share-image";
import { drawable, shareAlt, shareCard } from "@/components/share/share-words";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { shareCardFor, shareResponse } from "@/server/share-image";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";

/** The PNG's width and height, from its signature and IHDR chunk. */
function pngSize(body: Buffer) {
  expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(body.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

const png = async (response: Response) => {
  expect(response.headers.get("content-type")).toBe("image/png");
  return Buffer.from(await response.arrayBuffer());
};

// The unit tests' guard refuses every fetch (tests/unit/setup.ts); this one also counts what
// would reach the network, so a font satori fetches for a character next/og's own font lacks
// shows up here. Satori's layout engine loads its WASM from a data: URL, which is answered.
function countFetches() {
  const network = vi.fn();
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("data:"))
      return new Response(
        Buffer.from(url.slice(url.indexOf(",") + 1), "base64"),
      );
    network(url);
    return new Response("no network", { status: 503 });
  });
  return network;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the link preview's PNG", () => {
  it("draws the saved build's poster at 1200×630 from the build store alone", async () => {
    const latest = vi.fn(async () => syntheticSavedBuild());
    const fetches = countFetches();
    const card = await shareCardFor({ latest }, SAGEBRUSH_SOUND);
    expect(latest).toHaveBeenCalledWith(SAGEBRUSH_SOUND.id);
    expect(card.kind).toBe("poster");
    expect(pngSize(await png(shareResponse(card)))).toEqual({
      width: 1200,
      height: 630,
    });
    expect(fetches).not.toHaveBeenCalled();
  });

  it("draws the plain card at 1200×630 for a festival with no saved build", async () => {
    const card = await shareCardFor(
      { latest: async () => null },
      SAGEBRUSH_SOUND,
    );
    expect(card).toEqual(shareCard(SAGEBRUSH_SOUND, null));
    expect(pngSize(await png(shareResponse(card)))).toEqual({
      width: 1200,
      height: 630,
    });
  });

  it("says in its alt text what the poster shows", () => {
    expect(shareAlt(SAGEBRUSH_SOUND)).toBe(
      "Sagebrush Sound, a fictional festival in Boise, Idaho: its booked headliners, then the acts Undercard drafted from what fans of Boise's music venues like, each in its venue's colour.",
    );
    // A town's route has one alt text for every town.
    expect(shareAlt(null)).toBe(
      "Sagebrush Sound, a fictional festival: its booked headliners, then the acts Undercard drafted from what fans of the town's music venues like, each in its venue's colour.",
    );
  });

  it("falls back to the plain card when the store fails", async () => {
    const card = await shareCardFor(
      {
        latest: async () => {
          throw new Error("store down");
        },
      },
      SAGEBRUSH_SOUND,
    );
    expect(card.kind).toBe("plain");
  });

  it("draws every character the names may keep without fetching a font", async () => {
    // Every character drawable() lets through unchanged, set as act names on the poster.
    const kept: string[] = [];
    for (let code = 0x21; code <= 0x2fff; code++) {
      const char = String.fromCodePoint(code);
      if (drawable(char) === char) kept.push(char);
    }
    expect(kept.length).toBeGreaterThan(300);
    const card = shareCard(SAGEBRUSH_SOUND, null);
    const names: string[] = [];
    for (let i = 0; i < kept.length; i += 40)
      names.push(kept.slice(i, i + 40).join(""));
    const fetches = countFetches();
    const poster = await shareCardFor(
      { latest: async () => syntheticSavedBuild() },
      SAGEBRUSH_SOUND,
    );
    if (poster.kind !== "poster") throw new Error("expected the poster");
    poster.bands[0].acts = names.map((name) => ({ name, hue: 0, climb: "↑9" }));
    await png(shareResponse(poster));
    // The plain card draws its line as it is, not in capitals: a few lines of it at a time.
    for (let i = 0; i < kept.length; i += 80)
      await png(
        shareResponse({ ...card, tagline: kept.slice(i, i + 80).join(" ") }),
      );
    expect(fetches).not.toHaveBeenCalled();
  });
});

describe("the poster in its sheet", () => {
  const synthetic = async () => {
    const card = await shareCardFor(
      { latest: async () => syntheticSavedBuild() },
      SAGEBRUSH_SOUND,
    );
    if (card.kind !== "poster") throw new Error("expected the poster");
    return card;
  };

  it("sets the synthetic build's names at the poster's sizes, inside the sheet", async () => {
    const layout = posterLayout(await synthetic());
    expect(layout.bands[0]).toBe(28);
    expect(layout.bands[1]).toBeGreaterThanOrEqual(18);
    expect(layout.left).toBeLessThanOrEqual(INNER_H);
    expect(layout.right).toBeLessThanOrEqual(INNER_H);
  });

  it("sets long names smaller, so they stay inside the sheet", async () => {
    const card = await synthetic();
    const long: typeof card = {
      ...card,
      festival: "Sagebrush Sound Weekender at the Old Penitentiary",
      headliners: [
        "The Owyhee Canyon Overland Orchestra",
        "Japanese Breakfast",
      ],
      venues: [
        { name: "The Lantern Room and Garden Stage", hue: 0, acts: "4 acts" },
        { name: "Fort Street Ballroom Upstairs", hue: 1, acts: "3 acts" },
        { name: "Cottonwood Social Hall", hue: 2, acts: "2 acts" },
        { name: "Linden Street Annex", hue: 3, acts: "1 act" },
      ],
      bands: [
        {
          ...card.bands[0],
          acts: [
            "Owyhee Canyon Overland Brass Society",
            "The Long Valley Lantern Choir",
            "Payette River Night Assembly",
            "Basque Block Revival Band",
          ].map((name, index) => ({ name, hue: index, climb: "↑12" })),
        },
        {
          ...card.bands[1],
          acts: [
            "Juniper Lane Weather Club",
            "Sego Lily and the Late Trains",
            "Foothill Radio Hour",
            "Table Rock Night Parade",
            "Boise Front Range Players",
            "Snake River Sun",
          ].map((name, index) => ({ name, hue: index % 4, climb: "NEW" })),
        },
      ],
    };
    const layout = posterLayout(long);
    const usual = posterLayout(card);
    expect(layout.festival).toBeLessThan(usual.festival);
    expect(layout.bands[0]).toBeLessThan(usual.bands[0]);
    expect(layout.left).toBeLessThanOrEqual(INNER_H);
    expect(layout.right).toBeLessThanOrEqual(INNER_H);
    expect(pngSize(await png(shareResponse(long)))).toEqual({
      width: 1200,
      height: 630,
    });
  });

  it("uses the theme's own colours (src/app/globals.css)", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    for (const [token, value] of Object.entries(SHARE_COLORS))
      expect(
        new RegExp(`--color-${token}:\\s*([^;]+);`).exec(css)?.[1].trim(),
        token,
      ).toBe(value);
  });
});
