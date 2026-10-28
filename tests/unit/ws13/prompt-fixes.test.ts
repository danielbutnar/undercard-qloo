// Daniel, 2026-10-28 21:50, two prompt fixes before the 29 towns' run. A place on Qloo's
// live-music list is skipped only when the planner is sure it never hosts concerts, never for its
// name or its food (the second run skipped Venue 311 as "a barbecue restaurant"); and a
// local pick is an artist, never a festival, venue, label or scene ("Treefort Music Fest").
import { describe, expect, it } from "vitest";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { systemPrompt } from "@/server/agent";
import { AGENT_TOOLS } from "@/server/agent-tools";
import { LANTERN, OPENING, read, runAgent, scriptedModel } from "./agent-kit";

const prompt = systemPrompt(SAGEBRUSH_SOUND);
const tool = (name: string) => {
  const found = AGENT_TOOLS.find((t) => t.name === name);
  if (!found) throw new Error(`no ${name} tool`);
  return JSON.stringify(found);
};

describe("skipping a listed place (Daniel, 21:50)", () => {
  it("tells the planner to skip a listed place only when it's sure the place never hosts concerts, and to read it when in doubt", () => {
    expect(prompt).not.toContain(
      "skip restaurants, cafes, breweries, theaters and arenas",
    );
    expect(prompt).toContain("only when you are sure it never hosts concerts");
    expect(prompt).toContain("never because of its name or its food");
    expect(prompt).toContain("When in doubt, read it.");
  });

  it("says the same in finish's not_music_venues and its reason", () => {
    const finish = tool("finish");
    expect(finish).toContain("sure never host concerts");
    expect(finish).toContain("never because of its name or its food");
    expect(finish).not.toContain("restaurants, cafes, breweries");
  });

  it("asks a refused planner to read the next place, skipping one only if it's sure it never hosts concerts", async () => {
    const { model, requests } = scriptedModel([
      ...OPENING,
      [read("mid", LANTERN), read("opener", LANTERN)],
      [
        {
          name: "finish",
          input: {
            anchor_venue_ids: [],
            summary: "Done reading.",
            stopped_because: "every_band_full",
            not_music_venues: [],
          },
        },
      ],
    ]);
    await runAgent(model);
    const refusals = requests.flatMap((request) =>
      request.messages.flatMap((message) =>
        Array.isArray(message.content)
          ? message.content.flatMap((block) =>
              block.type === "tool_result" &&
              typeof block.content === "string" &&
              block.content.includes("at least two music venues")
                ? [block.content]
                : [],
            )
          : [],
      ),
    );
    expect(refusals.length).toBeGreaterThan(0);
    for (const refusal of refusals) {
      expect(refusal).not.toContain("isn't a music venue");
      expect(refusal).toContain("only if you are sure it never hosts concerts");
    }
  });
});

describe("local picks are artists (Daniel, 21:50)", () => {
  it("asks for artists only in step 6, in the local_pick tool and in its name field", () => {
    const words =
      "artists only (bands or solo acts), never a festival, venue, label or scene";
    expect(prompt.toLowerCase()).toContain(words);
    expect(tool("local_pick").toLowerCase()).toContain(words);
    expect(tool("local_pick")).toContain(
      "a band or a solo act, never a festival, venue, label or scene",
    );
  });
});
