// @vitest-environment jsdom
// Daniel, 28 October (17:10): "Local picks. The prompt asks for one or two acts from the town that
// fit the mid-size or opening tier, gives the tiers' popularity ranges, and asks for artist names
// only, never a phrase. A pick above both tiers is still shown, but labelled "above both tiers:
// headliner-sized, not for this bill", and it never gets an "Add to the bill" action." The ranges
// are the festival's own; a pick below both tiers stays as it was. Invented data only.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocalPickBox } from "@/components/local-pick-box";
import type { Festival } from "@/lib/festival";
import type { LocalPick } from "@/lib/local-pick";
import { systemPrompt } from "@/server/agent";
import { LARKSPUR_FESTIVAL, runAgent, scriptedModel } from "./agent-kit";

afterEach(cleanup);

const rangeOf = (festival: Festival, id: "mid" | "opener") => {
  const band = festival.feeBands.find((entry) => entry.id === id)!;
  return `${band.minPopularity.toFixed(2)}–${band.maxPopularity.toFixed(2)}`;
};

// A festival whose tiers sit lower: the prompt gives its own ranges, not Larkspur's.
const LOWER: Festival = {
  ...LARKSPUR_FESTIVAL,
  feeBands: LARKSPUR_FESTIVAL.feeBands.map((band) =>
    band.id === "mid"
      ? { ...band, minPopularity: 0.7, maxPopularity: 0.85 }
      : { ...band, minPopularity: 0.4, maxPopularity: 0.7 },
  ),
};

const step6 = (prompt: string) =>
  prompt.split("\n").find((line) => line.startsWith("6. "))!;

describe("the local pick's prompt (Daniel, 17:10)", () => {
  it("asks for one or two acts from the town that fit the mid-size or opening tier, with the festival's own ranges, by artist name only", () => {
    for (const festival of [LARKSPUR_FESTIVAL, LOWER]) {
      const line = step6(systemPrompt(festival));
      expect(line).toMatch(/^6\. local_pick: /);
      expect(line).toMatch(/one or two acts from the town/);
      expect(line).toMatch(/fit the mid-size or opening tier/);
      expect(line).toContain(
        `${rangeOf(festival, "mid")} for the mid-size tier`,
      );
      expect(line).toContain(
        `${rangeOf(festival, "opener")} for the opening tier`,
      );
      // Daniel, 21:50: artists only, never a festival, venue, label or scene.
      expect(line).toMatch(/artists only \(bands or solo acts\)/i);
      expect(line).toMatch(/never a phrase/);
    }
    expect(rangeOf(LOWER, "mid")).toBe("0.70–0.85");
    expect(systemPrompt(LOWER)).not.toBe(systemPrompt(LARKSPUR_FESTIVAL));
  });

  it("is the prompt the planner gets, and the local_pick tool says the same", async () => {
    const { model, requests } = scriptedModel([]);
    await runAgent(model, LOWER);
    expect(requests[0].system).toBe(systemPrompt(LOWER));
    const tool = requests[0].tools.find(
      (entry) => entry.name === "local_pick",
    )!;
    expect(tool.description).toMatch(/fit the mid-size or opening tier/);
    expect(tool.description).toContain("0.70–0.85 for the mid-size tier");
    expect(tool.description).toContain("0.40–0.70 for the opening tier");
    expect(tool.description).toMatch(/artists only \(bands or solo acts\)/i);
    expect(tool.description).toMatch(/never a phrase/);
  });
});

const IN_RANGE: LocalPick = {
  entityId: "local-1",
  name: "Larkspur Lanterns",
  asked: "Larkspur Lanterns",
  why: "A dream-pop four-piece from town.",
  popularity: 0.62,
  band: "opener",
  range: "in",
  sharedTags: [{ id: "urn:tag:genre:music:dream_pop", name: "Dream Pop" }],
};
const ABOVE: LocalPick = {
  entityId: "local-2",
  name: "Gravel Saints",
  asked: "The Gravel Saints",
  why: "Sells out the arena.",
  popularity: 0.97,
  band: null,
  range: "above",
  sharedTags: [],
};
const BELOW: LocalPick = {
  entityId: "local-3",
  name: "Porch Light",
  asked: "Porch Light",
  why: "Plays the town's bars.",
  popularity: 0.2,
  band: null,
  range: "below",
  sharedTags: [],
};

const boxWith = (picks: LocalPick[]) => {
  render(
    <LocalPickBox
      picks={picks}
      festival={LARKSPUR_FESTIVAL}
      added={[]}
      onToggle={() => {}}
    />,
  );
  return screen.getByRole("region", { name: "The AI's local pick" });
};
const itemOf = (box: HTMLElement, name: string) =>
  within(box)
    .getAllByRole("listitem")
    .find((item) => within(item).queryByText(name))!;

describe("a local pick above both tiers (Daniel, 17:10)", () => {
  it("is still shown, labelled headliner-sized and not for this bill, with no Add to the bill", () => {
    const box = boxWith([IN_RANGE, ABOVE]);
    const above = itemOf(box, "Gravel Saints");
    expect(
      within(above).getByText(
        /above both tiers: headliner-sized, not for this bill/,
      ),
    ).toBeTruthy();
    expect(
      within(above).queryByRole("button", { name: "Add to the bill" }),
    ).toBeNull();
    const inRange = itemOf(box, "Larkspur Lanterns");
    expect(
      within(inRange).getByRole("button", { name: "Add to the bill" }),
    ).toBeTruthy();
    expect(within(inRange).queryByText(/headliner-sized/)).toBeNull();
  });

  it("doesn't tell the buyer to add a pick that can't be added", () => {
    const box = boxWith([ABOVE]);
    expect(within(box).queryByText(/unless you add it/)).toBeNull();
    expect(within(box).getByText(/takes no slot\./)).toBeTruthy();
    expect(within(box).queryByRole("button")).toBeNull();
  });
});

describe("a local pick below both tiers (Daniel, 17:10: as it was)", () => {
  it("keeps its words and its Add to the bill", () => {
    const box = boxWith([BELOW]);
    expect(
      within(box).getByText(/^Popularity 20 on Qloo, below the fee ranges · /),
    ).toBeTruthy();
    expect(
      within(box).getByRole("button", { name: "Add to the bill" }),
    ).toBeTruthy();
    expect(
      within(box).getByText(/takes no slot unless you add it/),
    ).toBeTruthy();
    expect(within(box).queryByText(/headliner-sized/)).toBeNull();
  });
});
