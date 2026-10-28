// WS12 step 0: the Design 2.0 prototype is dev-only like the rest of /lab (src/lib/lab.ts), and
// each of its pages answers 404 before it reads anything, so a production build's prerender never
// reads the saved build for it.
import { afterEach, describe, expect, it, vi } from "vitest";

const read = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("read the saved build");
  }),
);
vi.mock("@/server/deps", () => ({
  serverBuildStore: read,
  serverCachedQloo: read,
  serverQloo: read,
}));
// Only the guard is under test: the screens and the readers stand in, so the file stays light
// beside the suite's timing tests.
vi.mock("@/app/lab/design-2/_kit/data", () => ({
  labFirstBill: read,
  labStory: read,
  labTowns: read,
}));
vi.mock("@/app/lab/design-2/_kit/how-it-works", () => ({
  BackstagePasses: () => null,
  DirectorsCut: () => null,
  TestedStamps: () => null,
}));
vi.mock("@/app/lab/design-2/_kit/card-page", () => ({ CardPage: () => null }));

afterEach(() => {
  vi.unstubAllEnvs();
  read.mockClear();
});

describe("the Design 2.0 prototype outside next dev", () => {
  it.each([
    ["How it works", () => import("@/app/lab/design-2/how-it-works/page")],
    ["the card", () => import("@/app/lab/design-2/card/page")],
    [
      "the card with both climbs",
      () => import("@/app/lab/design-2/card/control/page"),
    ],
  ])("%s answers 404 before reading the saved build", async (_name, load) => {
    // As on Vercel (and as under Vitest, whose NODE_ENV is "test"): the lab is off.
    vi.stubEnv("VERCEL", "1");
    const page = (await load()).default;
    await expect(async () => page()).rejects.toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/,
    );
    expect(read).not.toHaveBeenCalled();
  });
});
