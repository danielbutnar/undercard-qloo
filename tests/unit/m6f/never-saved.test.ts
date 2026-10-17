import { describe, expect, it } from "vitest";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { yourFestival } from "@/lib/your-festival";
import { handleUndercardBuild } from "@/server/undercard-build";
import { createMemoryLimiter } from "@/server/rate-limit";
import { readEvents, syntheticServer } from "../m3/scripted";

describe("a run on a judge's own brief", () => {
  it("runs the agent under its own festival id and saves nothing, so it can't become a default", async () => {
    const server = syntheticServer();
    const festival = yourFestival(
      {
        city: SAGEBRUSH_SOUND.city,
        headliners: [...SAGEBRUSH_SOUND.headliners],
      },
      "yours-test",
    );
    const events = await readEvents(
      await handleUndercardBuild({
        festival,
        limiter: createMemoryLimiter(),
        ip: "203.0.113.7",
        qloo: () => server.qloo,
        model: () => server.planner.model,
        store: server.store,
        fresh: true,
        save: false,
      }),
    );
    expect(events.some((event) => event.type === "lineup")).toBe(true);
    expect(await server.store.latest("yours-test")).toBeNull();
    expect(await server.store.latest(SAGEBRUSH_SOUND.id)).toBeNull();
  });
});
