// When the planner's model call fails or refuses, a live run ends the way a busy Qloo ends it:
// one error with its own code and no second diagnosis, so the page can offer the country's
// checked towns (or the saved build) instead of blaming the town. The model is a stub and Qloo
// is the synthetic one; nothing leaves the test.
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { BuildEvent } from "@/lib/build-events";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { yourFestival } from "@/lib/your-festival";
import type { AgentModel } from "@/server/ai";
import { createBuildStore } from "@/server/build-store";
import { createQlooClient } from "@/server/qloo";
import { createMemoryCache } from "@/server/qloo-cache";
import { createMemoryLimiter } from "@/server/rate-limit";
import { handleUndercardBuild } from "@/server/undercard-build";
import { fakeFetch, syntheticQloo } from "../m2/fake-qloo";
import { readEvents } from "../m3/scripted";

const OUTAGE =
  "The planning model is unavailable right now. Try again in a minute.";
const DECLINED = "The planning model declined this build. Try again.";

const outage: AgentModel = {
  nextTurn: async () => {
    throw new Error("synthetic outage");
  },
};

/** A planner that searches the headliners first, then declines; or declines at once. */
function decliner({ afterSearches }: { afterSearches: boolean }): AgentModel {
  let turn = 0;
  return {
    async nextTurn() {
      const index = turn++;
      const searches = afterSearches && index === 0;
      return {
        id: `msg_${index}`,
        type: "message",
        role: "assistant",
        model: "claude-sonnet-5-5",
        content: searches
          ? ["Khruangbin", "Japanese Breakfast"].map((name, k) => ({
              type: "tool_use",
              id: `toolu_${index}_${k}`,
              name: "search_artist",
              input: { name },
            }))
          : [],
        stop_reason: searches ? "tool_use" : "refusal",
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      } as unknown as Anthropic.Message;
    },
  };
}

const JUDGES_BRIEF = yourFestival(
  {
    city: "Duluth",
    region: "Minnesota",
    headliners: ["Khruangbin", "Japanese Breakfast"],
  },
  "yours-test",
);

async function run(
  model: AgentModel,
  { judge }: { judge: boolean } = { judge: true },
) {
  const store = createBuildStore(createMemoryCache());
  const events = await readEvents(
    handleUndercardBuild({
      festival: judge ? JUDGES_BRIEF : SAGEBRUSH_SOUND,
      qloo: () =>
        createQlooClient({
          apiKey: "test-key",
          cache: createMemoryCache(),
          fetch: fakeFetch(syntheticQloo).fetch,
        }),
      model: () => model,
      store,
      fresh: true,
      save: !judge,
      limiter: createMemoryLimiter(),
      ip: "203.0.113.7",
    }),
  );
  return { events, store };
}

const errors = (events: BuildEvent[]) =>
  events.filter((event) => event.type === "error");

describe("a planner call that fails or refuses ends a live run like a busy Qloo", () => {
  it("an outage on a judge's own brief: one coded error, then done, and no diagnosis of the town", async () => {
    const { events } = await run(outage);
    expect(errors(events)).toEqual([
      { type: "error", code: "planner-failed", message: OUTAGE },
    ]);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("a refusal on a judge's own brief ends the same way", async () => {
    const { events } = await run(decliner({ afterSearches: false }));
    expect(errors(events)).toEqual([
      { type: "error", code: "planner-failed", message: DECLINED },
    ]);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("a refusal after some Qloo calls ends the same way, with the calls kept on the trace", async () => {
    const { events } = await run(decliner({ afterSearches: true }));
    expect(events.filter((event) => event.type === "call")).toHaveLength(2);
    expect(errors(events)).toEqual([
      { type: "error", code: "planner-failed", message: DECLINED },
    ]);
  });

  it("a saved town's live run says so with the same code, and saves nothing", async () => {
    const { events, store } = await run(outage, { judge: false });
    expect(errors(events)).toEqual([
      { type: "error", code: "planner-failed", message: OUTAGE },
    ]);
    expect(await store.latest(SAGEBRUSH_SOUND.id)).toBeNull();
  });
});
