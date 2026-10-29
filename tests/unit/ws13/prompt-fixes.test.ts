// Daniel, 2026-10-28 21:50, two prompt fixes before the 29 towns' run. A place on Qloo's
// live-music list is skipped only when the planner is sure it never hosts concerts, never for its
// name or its food (the second run skipped Venue 311 as "a barbecue restaurant"); and a
// local pick is an artist, never a festival, venue, label or scene ("Treefort Music Fest").
import { describe, expect, it } from "vitest";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { systemPrompt } from "@/server/agent";
import { AGENT_TOOLS } from "@/server/agent-tools";
import {
  DINER,
  FORT,
  HALL,
  LANTERN,
  LARKSPUR_FESTIVAL,
  OPENING,
  read,
  runAgent,
  scriptedModel,
  type ToolCall,
} from "./agent-kit";

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

// Daniel, 2026-10-28 22:20: tightened in code. A skip is recorded only when the agent needs it to
// stop with fewer than two rooms; at most two local picks a build; a pick is an act the planner is
// confident is based in the town; a search that finds no artist says so, with no pick.
const NOT_MUSIC = "a coffee roaster with no stage, not a music venue";
const finishSkipping = (ids: string[]): ToolCall[] => [
  {
    name: "finish",
    input: {
      anchor_venue_ids: [],
      summary: "Done reading.",
      stopped_because: "every_band_full",
      not_music_venues: ids.map((id) => ({ entity_id: id, reason: NOT_MUSIC })),
    },
  },
];
const both = (venue: string): ToolCall[] => [
  read("mid", venue),
  read("opener", venue),
];
const texts = (statuses: { text: string }[]) =>
  statuses.map((status) => status.text);

describe("a skip only when the two-room rule needs it (Daniel, 22:20)", () => {
  it("records no skip when two rooms with fan data were read", async () => {
    const { model } = scriptedModel([
      ...OPENING,
      both(LANTERN),
      both(FORT),
      finishSkipping([DINER]),
    ]);
    const { statuses } = await runAgent(model);
    expect(texts(statuses).filter((t) => t.startsWith("Skipped "))).toEqual([]);
  });

  it("records none from a finish still refused, and each skip a finish needs to stop with one room", async () => {
    const { model } = scriptedModel([
      ...OPENING,
      both(LANTERN),
      both(HALL), // no fan data
      finishSkipping([DINER]), // refused: Fort Street Ballroom is still untried
      finishSkipping([FORT, DINER]), // accepted with one room: both skips needed
    ]);
    const { statuses } = await runAgent(model);
    const lines = texts(statuses);
    const refusal = lines.find((t) => t.startsWith("Tried to stop after "));
    // The refused finish kept no skip: the Diner is still untried in its line.
    expect(refusal).toContain("Sagebrush Diner");
    const skipped = lines.filter((t) => t.startsWith("Skipped "));
    expect(skipped).toHaveLength(2);
    expect(lines.indexOf(skipped[0])).toBeGreaterThan(lines.indexOf(refusal!));
  });
});

describe("local picks, tightened (Daniel, 22:20)", () => {
  const pick = (name: string) => ({ name, why: "A local act." });
  const sentence = (town: string) =>
    `Name an act only if you are confident it is based in ${town}; if you are not sure, name none.`;

  it("asks only for acts the planner is confident are based in the festival's town", async () => {
    expect(systemPrompt(SAGEBRUSH_SOUND)).toContain(sentence("Boise"));
    const { model, requests } = scriptedModel([]);
    await runAgent(model, LARKSPUR_FESTIVAL);
    expect(requests[0].system).toContain(sentence(LARKSPUR_FESTIVAL.city));
    const tool = requests[0].tools.find((t) => t.name === "local_pick")!;
    expect(tool.description).toContain(sentence(LARKSPUR_FESTIVAL.city));
  });

  it("searches at most two picks a build", async () => {
    const { model } = scriptedModel([
      ...OPENING,
      [{ name: "local_pick", input: { picks: [pick("Alpha"), pick("Beta")] } }],
      [{ name: "local_pick", input: { picks: [pick("Gamma")] } }],
    ]);
    const { calls } = await runAgent(model);
    expect(calls.filter((call) => call.tool === "local_pick")).toHaveLength(2);
  });

  it("records a search that finds no artist as not an artist Qloo knows, with no pick", async () => {
    const { model } = scriptedModel([
      ...OPENING,
      [
        {
          name: "local_pick",
          input: { picks: [pick("Treefort Music Fest")] },
        },
      ],
    ]);
    const { calls, result } = await runAgent(model);
    const search = calls.find((call) => call.tool === "local_pick")!;
    expect(search.summary).toContain("not an artist Qloo knows");
    expect(JSON.stringify(result)).not.toContain(
      '"asked":"Treefort Music Fest"',
    );
  });
});
