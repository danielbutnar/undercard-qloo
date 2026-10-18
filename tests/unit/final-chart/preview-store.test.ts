import { describe, expect, it } from "vitest";
import {
  createBuildStore,
  previewSafe,
  type SavedBuild,
} from "@/server/build-store";
import { createMemoryCache } from "@/server/qloo-cache";

// An invented saved build, the smallest that parses.
const build: SavedBuild = {
  id: "build-1",
  festivalId: "sagebrush-sound",
  createdAt: "2026-10-18T12:00:00.000Z",
  trace: [],
  lineup: { festivalId: "sagebrush-sound", acts: [] },
  context: { headliners: [], comparedTags: [], baselines: {}, anchors: {} },
};

describe("saved builds on a preview deployment", () => {
  it("are read but never saved, so a fresh run there can't move a festival's latest build", async () => {
    const cache = createMemoryCache();
    await createBuildStore(cache).save(build);
    const store = previewSafe(createBuildStore(cache), {
      VERCEL_ENV: "preview",
    });
    await store.save({ ...build, id: "build-2" });
    expect((await store.latest("sagebrush-sound"))?.id).toBe("build-1");
    expect(await store.byId("build-2")).toBeNull();
  });

  it("are saved as before in production and locally", async () => {
    for (const env of [{ VERCEL_ENV: "production" }, {}]) {
      const store = previewSafe(createBuildStore(createMemoryCache()), env);
      await store.save(build);
      expect((await store.latest("sagebrush-sound"))?.id).toBe("build-1");
    }
  });
});
