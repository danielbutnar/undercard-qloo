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
  // WS9: the top bar's tagline is the first line: an AI agent, built on Qloo, and in the same
  // sentence what Qloo is.
  it("opens on an AI agent, and says what Qloo is where it's first named", async () => {
    await firstScreen();
    const tagline = within(screen.getByRole("banner")).getByText(
      /^An AI agent/,
    );
    // The first "agent" on the page is the AI agent.
    const text = visibleText();
    const agent = text.search(/\bagent\b/);
    expect(text.slice(agent - 3, agent)).toBe("AI ");
    // The first "Qloo" on the page is in the tagline...
    const line = withoutSrOnly(tagline);
    expect(text.indexOf("Qloo")).toBe(text.indexOf(line) + line.indexOf("Qloo"));
    // ...which says at once, in the same sentence, what it is.
    expect(line).toBe(
      "An AI agent for festival bookers, built on Qloo, a taste-data service that maps what fans of one artist, venue or film also like.",
    );
  });

  // WS9: the poster says each band's Qloo popularity range, "our stand-in for fee"; How an act
  // gets on, below it, says each fee range in words.
  it("says fee range, never fee band", async () => {
    await firstScreen();
    const text = visibleText();
    expect(text).not.toMatch(/fee band/i);
    expect(text).toMatch(/fee range/);
    expect(
      within(
        screen.getByRole("region", { name: "Mid-size acts" }),
      ).getByText("· Qloo popularity 80–92, our stand-in for fee"),
    ).toBeTruthy();
    // The plain word first, the buyer's term once in brackets.
    for (const band of SAGEBRUSH_SOUND.feeBands)
      expect(text).toContain(`fee range (${band.label})`);
  });

  // M6r: the plain word first, the buyer's word once in brackets. WS9's first screen says
  // poster, lineup and slots, and never the buyer's "bill" on its own.
  it("never says a bare bill", async () => {
    await firstScreen();
    const text = visibleText().replace("lineup (the bill)", "");
    expect(text).not.toMatch(/\bbill\b/i);
  });

  it("puts what each climb counts next to it, in words", async () => {
    await firstScreen();
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    const rows = within(bill).getAllByRole("article");
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      // Seen: the climb beside the name, "↑14" (M10a, WS9).
      const climb = Number(
        /^↑(\d+)$/.exec(row.querySelector(".poster-climb")!.textContent!)![1],
      );
      // Heard: the venue whose fans were added and how many places the act climbed.
      expect(row.querySelector(".sr-only")!.textContent).toMatch(
        new RegExp(`^With .+'s fans added: up ${climb} places in Qloo's ranking$`),
      );
    }
    // The poster's key says in words what the climb counts, once.
    expect(
      within(bill).getAllByText(
        "↑ = places it rose in Qloo's ranking with that venue's fans (5+ to qualify); the strongest Qloo match takes each slot",
      ),
    ).toHaveLength(1);
    // The example line says one act's climb as a sentence, from its places.
    expect(bill.querySelector(".poster-example")!.textContent).toMatch(
      /.+ climbed from \d+(st|nd|rd|th) to \d+(st|nd|rd|th) in Qloo's ranking once .+'s fans joined the headliners' fans\./,
    );
    // The card says it as a sentence (plan.md item 5): the venue's fans' place, the headliners'
    // fans' place and the climb.
    const first = rows[0].querySelector("button")!;
    fireEvent.click(first);
    const card = screen.getByRole("region", { name: "Act card" });
    expect(card.textContent).toMatch(
      /Why it's here: Fans of .+ rank .+ \d+(st|nd|rd|th); fans of the headliners alone rank them \d+(st|nd|rd|th)\. That climb of \d+ is why .+ is here\./,
    );
  });

  it("says a new entry is new to the top 50, in words", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    const fresh = fixtureActs.find((act) => liftOf(act)?.kind === "new")!;
    const bill = screen.getByRole("region", { name: "Undercard draft" });
    const row = within(bill).getByRole("article", { name: fresh.name });
    // Seen: NEW beside its name. Heard: new in Qloo's ranking, with the venue's fans.
    expect(row.querySelector(".poster-climb")!.textContent).toBe("NEW");
    expect(row.querySelector(".sr-only")!.textContent).toBe(
      `With ${fresh.anchorVenue.name}'s fans added: new in Qloo's ranking, from outside the headliners-only top 50`,
    );
    // The card says it as a sentence.
    fireEvent.click(within(row).getByRole("button", { name: fresh.name }));
    expect(
      screen.getByRole("region", { name: "Act card" }).textContent,
    ).toMatch(
      /Why it's here: Fans of .+ rank .+ \d+(st|nd|rd|th); fans of the headliners alone don't rank them in their top 50\. That climb into the top 50 is why .+ is here\./,
    );
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
