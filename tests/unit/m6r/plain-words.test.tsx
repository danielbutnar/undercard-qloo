// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { RunningOrderPanel } from "@/components/running-order-panel";
import { YourFestival } from "@/components/your-festival";
import { planRunningOrder } from "@/lib/running-order";
import { liftOf } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { readFirstBill } from "@/server/first-bill";
import { readEvents, syntheticServer } from "../m3/scripted";
import { acts as fixtureActs, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(cleanup);

async function firstScreen() {
  const server = syntheticServer();
  await readEvents(server.build());
  const saved = (await server.store.latest(SAGEBRUSH_SOUND.id))!;
  // The first bill as the page reads it from the saved build, with each act's places.
  const firstBill = (await readFirstBill(server.store, SAGEBRUSH_SOUND.id))!;
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={firstBill} />);
  return saved;
}

// The words kept for screen readers, away from a node's text.
const withoutSrOnly = (node: Node) => {
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".sr-only").forEach((child) => child.remove());
  return clone.textContent ?? "";
};

// The page's visible text, without the words kept for screen readers.
const visibleText = () => withoutSrOnly(document.body);

describe("plain words, round 2 (M6r)", () => {
  it("opens on an AI agent, and says what Qloo is where it's first named", async () => {
    await firstScreen();
    const lead = screen.getByRole("region", { name: "What Undercard does" });
    const lines = [...lead.querySelectorAll("p")].map((p) => p.textContent!);
    expect(lines[1].startsWith("Undercard is an AI agent")).toBe(true);
    // The first "agent" on the page is the AI agent.
    const text = visibleText();
    const agent = text.search(/\bagent\b/);
    expect(text.slice(agent - 3, agent)).toBe("AI ");
    // The first "Qloo" on the page is in the lead...
    const leadText = withoutSrOnly(lead);
    expect(text.indexOf("Qloo")).toBe(
      text.indexOf(leadText) + leadText.indexOf("Qloo"),
    );
    // ...and the line that names it is followed at once by the one saying what it is.
    const naming = lines.findIndex((line) => line.includes("Qloo"));
    const saying = lines.findIndex((line) =>
      line.startsWith("Qloo is a taste-data service"),
    );
    expect(saying).toBeGreaterThanOrEqual(naming);
    expect(saying - naming).toBeLessThanOrEqual(1);
    expect(lines[saying]).toMatch(
      /^Qloo is a taste-data service: it maps what fans of one artist, venue or film also like\.$/,
    );
  });

  it("says fee range, never fee band", async () => {
    await firstScreen();
    // Each band's fee range is explained behind its "?": open both so their words are on the page.
    for (const band of ["mid-size acts", "opening acts"])
      fireEvent.click(
        screen.getByRole("button", {
          name: `What the fee range for ${band} means`,
        }),
      );
    const text = visibleText();
    expect(text).not.toMatch(/fee band/i);
    expect(text).toMatch(/Fee range/);
    // The plain word first, the buyer's term once in brackets.
    for (const band of SAGEBRUSH_SOUND.feeBands)
      expect(text).toContain(`fee range (${band.label})`);
  });

  // M6r: the plain word first, the buyer's word once in brackets. The weekly chart's headline
  // says "lineup" on its own; the buyer's word comes once, under the headliners, before any
  // bare "bill".
  it("names the buyer's word once, in brackets after the plain one, with no bare bill before it", async () => {
    await firstScreen();
    const text = visibleText();
    const at = text.indexOf("lineup (the bill)");
    expect(at).toBeGreaterThan(-1);
    expect(text.slice(0, at)).not.toMatch(/\bbill\b/);
  });

  it("puts what each climb counts next to it, in words", async () => {
    await firstScreen();
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    const rows = within(bill).getAllByRole("article");
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      // Seen: the climb as the big number, with the ladder it sums up under the name, "49" with
      // "50th → 1st" (M10a).
      const climb = Number(row.querySelector(".row-place")!.textContent);
      const [, was, now] = /^(\d+)(?:st|nd|rd|th)(\d+)(?:st|nd|rd|th)$/.exec(
        row.querySelector(".ladder")!.textContent!,
      )!;
      expect(Number(was) - Number(now)).toBe(climb);
      // Heard: the venue's crowd and how many places it moved the act up.
      expect(row.querySelector(".sr-only")!.textContent).toMatch(
        /'s crowd: up \d+ places$/,
      );
    }
    // Each band's key says in words what the climb counts.
    expect(
      within(bill).getAllByText(
        "places it climbed with its venue's fans added",
      ),
    ).toHaveLength(2);
    // The card says it as a sentence: the venue's fans move it up N places.
    const first = rows[0].querySelector("button")!;
    fireEvent.click(first);
    const card = screen.getByRole("region", { name: "Act card" });
    expect(card.textContent).toMatch(
      /Why Boise: .+ fans move it up \d+ places\./,
    );
  });

  it("says a new entry is new to the top 50, in words", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    const fresh = fixtureActs.find((act) => liftOf(act)?.kind === "new")!;
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    const row = within(bill).getByRole("article", { name: fresh.name });
    // Seen: NEW, its ladder from outside the top 50. Heard: the same, with the venue's crowd.
    expect(row.querySelector(".row-place")!.textContent).toBe("NEW");
    expect(row.querySelector(".ladder")!.textContent).toMatch(
      /^outside the top 50\d+(st|nd|rd|th)$/,
    );
    expect(row.querySelector(".sr-only")!.textContent).toBe(
      `${fresh.anchorVenue.name}'s crowd: new, from outside the headliners-only top 50`,
    );
    // The card says it as a sentence.
    fireEvent.click(within(row).getByRole("button", { name: fresh.name }));
    expect(
      screen.getByRole("region", { name: "Act card" }).textContent,
    ).toMatch(/Why Boise: .+ fans move it into the top \d+\./);
  });

  it("says venue, not room", async () => {
    const saved = await firstScreen();
    // Venue names are proper nouns: the synthetic Lantern Room keeps its name.
    let text = visibleText();
    for (const act of saved.lineup.acts)
      text = text.split(act.anchorVenue.name).join("");
    expect(text).not.toMatch(/rooms?/i);
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
