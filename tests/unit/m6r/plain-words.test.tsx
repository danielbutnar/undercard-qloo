// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { RunningOrderPanel } from "@/components/running-order-panel";
import { YourFestival } from "@/components/your-festival";
import { planRunningOrder } from "@/lib/running-order";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { readEvents, syntheticServer } from "../m3/scripted";

afterEach(cleanup);

async function firstScreen() {
  const server = syntheticServer();
  await readEvents(server.build());
  const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
  render(
    <FestivalScreen
      festival={SAGEBRUSH_SOUND}
      firstBill={{
        build: { id: saved.id, createdAt: saved.createdAt },
        acts: saved.lineup.acts,
        calls: saved.trace.length,
        placesListed: 8,
        anchors: saved.context.anchors,
        baselineTop: { mid: 50, opener: 50 },
      }}
    />,
  );
  return saved;
}

// The page's visible text, without the words kept for screen readers.
const visibleText = () => {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".sr-only").forEach((node) => node.remove());
  return clone.textContent ?? "";
};

describe("plain words, round 2 (M6r)", () => {
  it("opens on an AI agent, and says what Qloo is where it's first named", async () => {
    await firstScreen();
    const first = screen.getByRole("banner").querySelector("p")!.textContent!;
    expect(first.startsWith("Undercard is an AI agent")).toBe(true);
    expect(visibleText().indexOf("Qloo")).toBe(
      visibleText().indexOf(first) + first.indexOf("Qloo"),
    );
    expect(first).toMatch(/Qloo, a taste-data service/);
  });

  it("says fee range, never fee band, and lineup (the bill) at first use", async () => {
    await firstScreen();
    const text = visibleText();
    expect(text).not.toMatch(/fee band/i);
    expect(text).toMatch(/fee range/);
    expect(text.indexOf("lineup (the bill)")).toBeGreaterThan(-1);
    // The first "lineup" carries the buyer's word once, and no bare "bill" comes before it.
    const first = text.indexOf("lineup");
    expect(text.slice(first, first + "lineup (the bill)".length)).toBe(
      "lineup (the bill)",
    );
    expect(text.slice(0, first)).not.toMatch(/bill/);
  });

  it("puts what each +N counts next to it, in words", async () => {
    await firstScreen();
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    for (const article of within(bill).getAllByRole("article")) {
      const text = article.textContent ?? "";
      expect(text).toMatch(
        /(\+\d+ places higher in Qloo's ranking|new to Qloo's top \d+)/,
      );
    }
  });

  it("says venue, not room", async () => {
    const saved = await firstScreen();
    // Venue names are proper nouns: the synthetic Lantern Room keeps its name.
    let text = visibleText();
    for (const act of saved.lineup.acts)
      text = text.split(act.anchorVenue.name).join("");
    expect(text).not.toMatch(/rooms?/i);
  });

  it("names the AI agent first on Your festival too", () => {
    render(<YourFestival />);
    const text = visibleText();
    const agent = text.search(/\bagent\b/);
    expect(text.slice(agent - 3, agent)).toBe("AI ");
    expect(text).not.toMatch(/fee band|\brooms?\b/i);
  });
});

describe("the running order's honest number (M6r)", () => {
  const act = (id: string, band: "mid" | "opener", popularity: number) => ({
    entityId: id,
    name: id.toUpperCase(),
    band,
    popularity,
  });
  const acts = [
    act("o1", "opener", 0.6),
    act("o2", "opener", 0.62),
    act("o3", "opener", 0.7),
    act("o4", "opener", 0.72),
    act("m1", "mid", 0.85),
    act("m2", "mid", 0.88),
  ];
  const scores: Record<string, number> = {
    "o1|o2": 0.95,
    "o1|o3": 0.8,
    "o1|o4": 0.82,
    "o2|o3": 0.81,
    "o2|o4": 0.79,
    "o3|o4": 0.9,
    "m1|m2": 0.88,
  };
  const shared = (a: string, b: string) =>
    scores[[a, b].sort().join("|")] ?? null;

  it("ranks each clash among the lineup's scored pairs, closest first", () => {
    const slots = planRunningOrder(acts, shared, SAGEBRUSH_SOUND.feeBands);
    expect(slots.every((slot) => slot.pairs === 7)).toBe(true);
    const m = slots.find((slot) => slot.band === "mid")!;
    expect(m.rank).toBe(3);
  });

  it("says how close the fans' tastes are by rank, not as a bare decimal or an overlap", () => {
    const slots = planRunningOrder(acts, shared, SAGEBRUSH_SOUND.feeBands);
    render(
      <RunningOrderPanel
        slots={slots}
        headliners={["A", "B"]}
        onClose={() => {}}
      />,
    );
    const text = visibleText();
    expect(text).not.toMatch(/overlap/i);
    expect(text).not.toMatch(/0\.\d\d/);
    expect(text).toMatch(/3rd closest of 7 pairs on this lineup/);
    expect(text).toMatch(/not a count of shared ticket buyers/);
  });
});
