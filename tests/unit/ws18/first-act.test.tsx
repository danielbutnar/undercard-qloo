// @vitest-environment jsdom
// WS18 (Daniel, 29 Oct, 20:40; SPEC section 3: "the first act lands within 3 seconds"): Watch on
// a build shaped like Boise's 2.0 one, through the real replay and its pacing: the lookups, the
// tag, the places, the baselines, then a venue Qloo had no fan data for, then the first venue
// whose fans lift acts. The steps before that first lift play faster, every caption kept, so the
// first act lands within 3 s of pressing Watch, on a laptop (its card lands, then its slot stamps
// in) and on a phone (it lands in place). On the test's own clock; invented data only.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import type { FirstBill } from "@/lib/first-bill";
import { createBuildStore, type BuildStore } from "@/server/build-store";
import { readFirstBill } from "@/server/first-bill";
import { createQlooClient, type QlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents } from "../m3/scripted";
import { settle } from "../test-clock";
import {
  FORT,
  HALL,
  HALL_NAME,
  LANTERN,
  LARKSPUR_FESTIVAL,
  OPENING,
  scriptedModel,
  type Turn,
} from "../ws13/agent-kit";

const why = (band: "mid" | "opener", venue: string, text: string) => ({
  name: "venue_artists",
  input: { band, venue_id: venue, why: text },
});
// Boise's shape: the town's biggest room first, which Qloo had no fan data for.
const PLAN: Turn[] = [
  ...OPENING,
  [
    why("mid", HALL, "Larkspur Music Hall is the town's biggest club."),
    why("opener", HALL, "Larkspur Music Hall is the town's biggest club."),
  ],
  [
    why("mid", LANTERN, `Qloo had no fan data for ${HALL_NAME}.`),
    why("opener", LANTERN, `Qloo had no fan data for ${HALL_NAME}.`),
  ],
  [
    why("mid", FORT, "Fort Street Ballroom is the second room with fan data."),
    why(
      "opener",
      FORT,
      "Fort Street Ballroom is the second room with fan data.",
    ),
  ],
  [
    {
      name: "finish",
      input: {
        anchor_venue_ids: [LANTERN, FORT],
        summary: "Read the Lantern Room and Fort Street Ballroom.",
        stopped_because: "every_band_full",
      },
    },
  ],
];

let store: BuildStore;
let cached: QlooClient;
let firstBill: FirstBill;

// The saved build, made by the agent on synthetic Qloo, on the wall clock.
beforeAll(async () => {
  const cache = createMemoryCache();
  store = createBuildStore(cache);
  const qloo = createQlooClient({
    apiKey: "k",
    cache,
    fetch: fakeFetch(syntheticQloo).fetch,
  });
  await readEvents(
    handleUndercardBuild({
      festival: LARKSPUR_FESTIVAL,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
      store,
      fresh: true,
      qloo: () => qloo,
      model: () => scriptedModel(PLAN).model,
    }),
  );
  cached = createQlooClient({
    apiKey: "k",
    cache,
    cacheOnly: true,
    fetch: () => {
      throw new Error("a replay reads the Qloo cache only");
    },
  });
  firstBill = (await readFirstBill(store, LARKSPUR_FESTIVAL.id))!;
});

// From here the test's own clock, Date included, so the time to the first act reads on it.
// requestAnimationFrame and performance.now stay real (the town's glide needs a measured
// viewport, which jsdom never gives).
beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (Element.prototype as { animate?: unknown }).animate;
});

describe.each([
  { device: "a laptop", wide: true },
  { device: "a phone", wide: false },
])("Watch's first act, on $device (WS18)", ({ wide }) => {
  it("lands within 3 s of pressing Watch, every caption before it kept", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: wide && query.includes("min-width: 1100px"),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    Object.defineProperty(Element.prototype, "animate", {
      value: () => ({ finished: Promise.resolve(), cancel() {} }),
      configurable: true,
      writable: true,
    });
    // The replay as POST /api/undercard streams it, at its own pace, from the saved build.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/undercard")
          ? handleUndercardBuild({
              festival: LARKSPUR_FESTIVAL,
              limiter: createMemoryLimiter(),
              ip: "203.0.113.7",
              store,
              fresh: false,
              qloo: () => null,
              model: () => null,
              cachedQloo: () => cached,
            })
          : new Response("{}", { status: 404 }),
      ),
    );
    render(
      <FestivalScreen festival={LARKSPUR_FESTIVAL} firstBill={firstBill} />,
    );
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    const captions = new Set<string>();
    const pressed = Date.now();
    fireEvent.click(
      screen.getByRole("button", { name: "Watch the AI agent build it" }),
    );
    // Each step's caption as the clock moves, until the first act is on the poster.
    await settle(() => {
      const caption = document.querySelector(
        ".scene-caption .edition-title, .poster-caption .edition-title",
      )?.textContent;
      if (caption) captions.add(caption);
      expect(within(bill).queryAllByRole("article").length).toBeGreaterThan(0);
    });
    const landed = Date.now() - pressed;
    // Its slot stamps in as its card arrives on a laptop; on a phone it is there at once.
    const stamps = within(bill)
      .getAllByRole("article")
      .map((article) => parseFloat(article.style.animationDelay || "0") * 1000);
    expect(landed + Math.min(...stamps)).toBeLessThanOrEqual(3000);
    expect([...captions]).toEqual(
      expect.arrayContaining([
        "Replaying the AI agent's build",
        "Khruangbin + Japanese Breakfast fans alone",
        `+ ${HALL_NAME}'s fans`,
        "+ The Lantern Room's fans",
      ]),
    );
  });
});
