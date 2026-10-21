// save() fails closed (Daniel's answers of 2026-10-21, night): a festival's latest build is set
// only after a read that finished cleanly and found no saved build. A read that fails or times
// out, or a saved build that is there but doesn't parse, leaves it alone, and the run is still
// kept under its own id. Production's cache is Upstash, whose reads turn an outage into a miss,
// so these run on the Upstash cache over a Redis that can fail. Everything here is invented data.
import { describe, expect, it } from "vitest";
import { createBuildStore, type SavedBuild } from "@/server/build-store";
import { createUpstashCache } from "@/server/qloo-cache";

const LATEST = "undercard:build:v1:latest:sagebrush-sound";
const BUILD = (id: string) => `undercard:build:v1:id:${id}`;

/** The smallest saved build that parses. */
const savedBuild = (id: string): SavedBuild => ({
  id,
  festivalId: "sagebrush-sound",
  createdAt: "2026-10-17T12:13:00.000Z",
  trace: [],
  lineup: { festivalId: "sagebrush-sound", acts: [] },
  context: { headliners: [], comparedTags: [], baselines: {}, anchors: {} },
});

/** A Redis that works until told to fail, or to hang, on reads of the keys given. */
function troubledRedis() {
  const data = new Map<string, unknown>();
  let trouble: { kind: "fail" | "hang"; key: string } | null = null;
  return {
    data,
    trouble: (kind: "fail" | "hang", key: string) => {
      trouble = { kind, key };
    },
    clear: () => {
      trouble = null;
    },
    redis: {
      get: async (key: string): Promise<unknown> => {
        if (trouble?.key === key) {
          if (trouble.kind === "fail") throw new Error("fetch failed");
          return new Promise(() => {});
        }
        return data.get(key) ?? null;
      },
      set: async (key: string, value: unknown) => {
        data.set(key, value);
        return "OK";
      },
    },
  };
}

// The test's own deadline, well past the store's limit, so a save that waits forever fails here.
const within = <T>(pending: Promise<T>, ms = 1000) =>
  Promise.race([
    pending,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`save still waiting after ${ms} ms`)),
        ms,
      ),
    ),
  ]);

describe("save() fails closed", () => {
  it("leaves latest alone when reading the pointer fails, and keeps the run under its own id", async () => {
    const r = troubledRedis();
    const store = createBuildStore(createUpstashCache(r.redis));
    await store.save(savedBuild("saved"));
    r.trouble("fail", LATEST);
    await expect(store.save(savedBuild("live"))).resolves.toBeUndefined();
    r.clear();
    expect(r.data.get(LATEST)).toBe("saved");
    expect((await store.byId("live"))?.id).toBe("live");
  });

  it("leaves latest alone when reading the build it points to fails", async () => {
    const r = troubledRedis();
    const store = createBuildStore(createUpstashCache(r.redis));
    await store.save(savedBuild("saved"));
    r.trouble("fail", BUILD("saved"));
    await store.save(savedBuild("live"));
    r.clear();
    expect(r.data.get(LATEST)).toBe("saved");
  });

  it("leaves latest alone when the read doesn't answer in time", async () => {
    const r = troubledRedis();
    const store = createBuildStore(createUpstashCache(r.redis), Date.now, {
      latestReadTimeoutMs: 50,
    });
    await store.save(savedBuild("saved"));
    r.trouble("hang", LATEST);
    await within(store.save(savedBuild("live")));
    r.clear();
    expect(r.data.get(LATEST)).toBe("saved");
    expect((await store.byId("live"))?.id).toBe("live");
  });

  it("leaves latest alone when the build it points to is there but doesn't parse", async () => {
    const r = troubledRedis();
    r.data.set(LATEST, "saved");
    r.data.set(BUILD("saved"), { lineup: "not a lineup" });
    await createBuildStore(createUpstashCache(r.redis)).save(
      savedBuild("live"),
    );
    expect(r.data.get(LATEST)).toBe("saved");
  });

  it("sets latest after a clean read that finds none: no pointer, or one to a build no longer stored", async () => {
    const empty = troubledRedis();
    await createBuildStore(createUpstashCache(empty.redis)).save(
      savedBuild("first"),
    );
    expect(empty.data.get(LATEST)).toBe("first");

    const dangling = troubledRedis();
    dangling.data.set(LATEST, "expired");
    await createBuildStore(createUpstashCache(dangling.redis)).save(
      savedBuild("next"),
    );
    expect(dangling.data.get(LATEST)).toBe("next");
  });
});
