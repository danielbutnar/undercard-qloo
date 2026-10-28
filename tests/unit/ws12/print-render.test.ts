// WS12 item 6: POST /api/poster draws the poster it's sent as a print-size PNG with next/og (no
// new dependency), as the link preview is drawn, and hands it over as a download. It reads
// nothing but the request: no build store, no Qloo, no model, and never a font from the network.
// Invented acts and venues.
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/poster/route";
import { PRINT_SIZE } from "@/components/share/print-image";
import type { PrintRequest } from "@/components/share/print-words";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

/** The PNG's width and height, from its signature and IHDR chunk. */
function pngSize(body: Buffer) {
  expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(body.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

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

const REQUEST: PrintRequest = {
  festival: SAGEBRUSH_SOUND.id,
  venues: [
    { name: "The Lantern Room", hue: 0, acts: 2 },
    { name: "Fort Street Ballroom", hue: 1, acts: 1 },
  ],
  bands: [
    {
      id: "mid",
      acts: [
        {
          name: "Hollow Pines",
          hue: 0,
          place: 5,
          climb: { kind: "up", places: 14 },
        },
        { name: "Ruby Ash", hue: 1, place: 12, climb: { kind: "new" } },
      ],
      open: 2,
    },
    {
      id: "opener",
      acts: [
        {
          name: "Sego Lily",
          hue: 0,
          place: 3,
          climb: { kind: "up", places: 9 },
        },
      ],
      open: 5,
    },
  ],
};

const post = (body: string) =>
  POST(
    new Request("http://localhost/api/poster", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );

describe("POST /api/poster", () => {
  it("draws the poster as a print-size PNG download, from the request alone", async () => {
    const fetches = countFetches();
    const started = performance.now();
    const response = await post(JSON.stringify(REQUEST));
    const body = Buffer.from(await response.arrayBuffer());
    const seconds = (performance.now() - started) / 1000;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="sagebrush-sound-fictional-demo-festival-poster.png"',
    );
    expect(pngSize(body)).toEqual(PRINT_SIZE);
    // Daniel's bounds for Vercel: under 10 s and a few MB.
    expect(body.length).toBeLessThan(4_000_000);
    expect(seconds).toBeLessThan(10);
    expect(fetches).not.toHaveBeenCalled();
  });

  it("refuses a body that isn't a poster it can vouch for", async () => {
    countFetches();
    for (const body of [
      "not json",
      JSON.stringify({ ...REQUEST, festival: "somewhere-else" }),
      JSON.stringify({ ...REQUEST, bands: [] }),
    ])
      expect((await post(body)).status).toBe(400);
  });

  it("refuses a body far bigger than any poster", async () => {
    countFetches();
    const response = await post(
      JSON.stringify({ ...REQUEST, padding: "x".repeat(40_000) }),
    );
    expect(response.status).toBe(413);
  });
});
