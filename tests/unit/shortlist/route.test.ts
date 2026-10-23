// WS4, the buyer's shortlist, step 4: POST /api/shortlist. At most 10 names; the town must be one
// of the checked towns with a saved build; a check is limited per IP and per day like a live
// build, with the limiter's own friendly message, and a refused request never reaches Qloo.
// Invented names and ids.
import { describe, expect, it } from "vitest";
import { ShortlistSchema } from "@/lib/shortlist";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { createBuildStore } from "@/server/build-store";
import { createMemoryCache } from "@/server/qloo-cache";
import {
  createMemoryLimiter,
  LIMITS,
  type RateLimiter,
} from "@/server/rate-limit";
import { handleShortlist } from "@/server/shortlist";
import { qlooWorld, savedBuild, shortlistQloo } from "./world";

const AT = Date.UTC(2026, 10, 3, 12);

async function server({
  limiter = createMemoryLimiter({ now: () => AT }),
}: { limiter?: RateLimiter } = {}) {
  const store = createBuildStore(createMemoryCache());
  await store.save(savedBuild());
  const world = qlooWorld(shortlistQloo());
  const post = (body: unknown, ip = "203.0.113.7") =>
    handleShortlist({
      body,
      store,
      clients: async () => ({ live: world.live, cached: world.cached }),
      limiter,
      ip,
    });
  return { post, world, store };
}

const body = (names: string[], festival: string = SAGEBRUSH_SOUND.id) => ({
  festival,
  names,
});

describe("POST /api/shortlist (WS4, step 4)", () => {
  it("answers a check with its sorted shortlist", async () => {
    const { post } = await server();

    const response = await post(body(["Marigold Static", "Velvet Coyote"]));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { shortlist } = (await response.json()) as { shortlist: unknown };
    const parsed = ShortlistSchema.parse(shortlist);
    expect(parsed.festivalId).toBe(SAGEBRUSH_SOUND.id);
    expect(parsed.acts.map((act) => act.name)).toEqual([
      "Marigold Static",
      "Velvet Coyote",
    ]);
  });

  it("takes at most 10 names, counted once each, and refuses more before any call", async () => {
    const { post, world } = await server();
    const eleven = Array.from(
      { length: 11 },
      (_, i) => `Invented Act ${i + 1}`,
    );

    const refused = await post(body(eleven));
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({
      error: "Paste at most 10 names: this list has 11.",
      code: "too-many",
    });
    expect(world.requests).toHaveLength(0);

    // A repeat counts once: ten names and one of them again is ten.
    const ten = await post(body([...eleven.slice(0, 10), "invented act 1"]));
    expect(ten.status).toBe(200);
  });

  it("refuses no names, a town that isn't a checked one, and a town with no saved build", async () => {
    const { post, world } = await server();

    expect((await post(body(["", "  "]))).status).toBe(400);
    expect((await post(body(["Velvet Coyote"], "yours-1234"))).status).toBe(
      400,
    );
    const unsaved = await post(
      body(["Velvet Coyote"], "sagebrush-sound-austin"),
    );
    expect(unsaved.status).toBe(404);
    expect(await unsaved.json()).toEqual({
      error:
        "Undercard has no saved build for Austin yet, so it has no venues to read there.",
      code: "no-saved-build",
    });
    expect(world.requests).toHaveLength(0);
  });

  it("limits each IP to 5 checks a day, with the live build's friendly message, before calling Qloo", async () => {
    expect(LIMITS.shortlist).toMatchObject({
      perIp: 5,
      perDay: 60,
      noun: "shortlist checks",
    });
    const { post, world } = await server();
    for (let i = 0; i < 5; i++)
      expect((await post(body(["Velvet Coyote"]))).status).toBe(200);
    const calls = world.requests.length;

    const limited = await post(body(["Velvet Coyote"]));

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe(String(12 * 60 * 60));
    expect(await limited.json()).toEqual({
      error:
        "You've used today's 5 shortlist checks from this network. Try again tomorrow (UTC).",
      code: "limit",
    });
    expect(world.requests).toHaveLength(calls);
    // Another network still has its own checks.
    expect((await post(body(["Velvet Coyote"]), "198.51.100.9")).status).toBe(
      200,
    );
  });

  it("limits everyone together per day, with the same kind of message", async () => {
    const limiter = createMemoryLimiter({
      now: () => AT,
      limits: { ...LIMITS, shortlist: { ...LIMITS.shortlist, perDay: 2 } },
    });
    const { post } = await server({ limiter });
    await post(body(["Velvet Coyote"]), "198.51.100.1");
    await post(body(["Velvet Coyote"]), "198.51.100.2");

    const limited = await post(body(["Velvet Coyote"]), "198.51.100.3");

    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({
      error:
        "Undercard has reached today's limit of 2 shortlist checks for everyone. Try again tomorrow (UTC).",
      code: "limit",
    });
  });

  it("doesn't spend a check on a request it refuses", async () => {
    const { post } = await server();
    for (let i = 0; i < 5; i++) await post(body([]));

    expect((await post(body(["Velvet Coyote"]))).status).toBe(200);
  });
});
