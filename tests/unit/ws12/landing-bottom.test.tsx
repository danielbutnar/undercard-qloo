// @vitest-environment jsdom
// WS12 item 1: the landing's lower half, on the synthetic first bill and the synthetic build's
// trace (invented acts and venues). The AI agent's setlist takes the Qloo calls panel's place
// (the full calls list stays under it), the door check takes How an act gets on's, the second
// venue switch is gone (its sentence under the poster key), and the page ends on who decides.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Ticket } from "@/components/chart/ticket";
import { FestivalScreen } from "@/components/festival-screen";
import { billPlaces } from "@/lib/places";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { syntheticSavedBuild } from "../../e2e/synthetic-build";
import { acts, FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const saved = syntheticSavedBuild();
const BILL = {
  ...FIRST_BILL,
  places: billPlaces(saved.lineup.acts, saved.context.baselines),
  trace: saved.trace,
  notes: saved.notes,
};
const open = () =>
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={BILL} />);
const setlistLines = () =>
  within(
    screen.getByRole("region", { name: "The AI agent's setlist" }),
  ).getAllByRole("listitem", { name: /^Call \d+/ });

describe("the AI agent's setlist", () => {
  it("lists the saved build's calls in order, the one that lifted the first act circled", () => {
    open();
    const lines = setlistLines();
    expect(lines).toHaveLength(12);
    expect(lines[7].getAttribute("aria-label")).toMatch(
      /^Call 8: Mid-size \+ The Lantern Room fans/,
    );
    expect(lines[7].className).toContain("is-circled");
    expect((lines[7]).textContent).toContain("Hollow Pines");
    expect(
      lines.filter((line) => line.className.includes("is-circled")),
    ).toHaveLength(1);
  });

  it("cues the AI agent's own lines in its own words, apart from Watch's caption", () => {
    open();
    const sheet = screen.getByRole("region", { name: "The AI agent's setlist" });
    expect(sheet.textContent).toContain(`The AI agent: ${saved.notes![0].text}`);
    expect(sheet.textContent).not.toContain("The AI agent's plan:");
  });

  it("marks the venue Qloo had no fan data for", () => {
    render(
      <FestivalScreen
        festival={SAGEBRUSH_SOUND}
        firstBill={{
          ...BILL,
          noFanData: [saved.context.anchors.mid![2].entityId],
        }}
      />,
    );
    expect((setlistLines()[11]).textContent).toContain("no fan data");
  });

  it("plays it live: a fresh run of the agent, in place of Run the agent live instead", () => {
    const fetch = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetch);
    open();
    expect(
      screen.queryByRole("button", { name: "Run the agent live instead" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play it live" }));
    expect(fetch).toHaveBeenCalled();
    const build = (
      fetch.mock.calls as unknown as [string, RequestInit][]
    ).find(([url]) => String(url).includes("/api/undercard"));
    expect(JSON.parse(String(build?.[1].body)).fresh).toBe(true);
  });
});

describe("the door check", () => {
  it("takes How an act gets on's place: the first act's ticket, stamped three times, and the fee ranges in words", () => {
    open();
    expect(
      screen.queryByRole("region", { name: "How an act gets on" }),
    ).toBeNull();
    const door = screen.getByRole("region", { name: "The door check" });
    const ticket = within(door).getByRole("article", {
      name: "Hollow Pines's ticket",
    });
    expect(
      within(ticket).getAllByRole("listitem", {
        name: /^(Climb|Popularity|Genres)/,
      }),
    ).toHaveLength(3);
    expect((door).textContent).toContain(
      "4 slots · fee range (Mid): with no real fees to go on, how popular an act is on Qloo stands in for what it charges (80th–92nd percentile)",
    );
  });

  it("follows the act pointed at on the poster, and the setlist circles its call", () => {
    open();
    const poster = screen.getByRole("region", { name: "Undercard draft" });
    fireEvent.pointerEnter(
      within(poster).getByRole("article", { name: "Owyhee Drift" }),
    );
    expect(
      screen.getByRole("article", { name: "Owyhee Drift's ticket" }),
    ).toBeTruthy();
    expect(setlistLines()[10].className).toContain("is-circled");
  });

  it("stamps the local lift against the bar from the act's own data, both climbs as the card words them (WS13.3)", () => {
    render(
      <Ticket
        act={{
          ...acts[0],
          localLift: {
            venueClimb: 11,
            controlClimb: 4,
            control: { entityId: "control-1", name: "A Room Abroad", town: "Elsewhere" },
          },
        }}
        band={SAGEBRUSH_SOUND.feeBands[0]}
        hue={0}
        festival={SAGEBRUSH_SOUND}
      />,
    );
    const stamp = screen.getByRole("listitem", { name: /^Climb/ });
    expect(stamp.textContent).toContain("↑7");
    expect(stamp.textContent).toContain("local lift");
    expect(stamp.textContent).toContain("↑11 with The Lantern Room's fans");
    expect(stamp.textContent).toContain("↑4 with a matched venue abroad");
  });
});

describe("the second venue switch and the page's end", () => {
  it("drops Switch a venue off; under the poster key, exactly Daniel's line (2026-10-28)", () => {
    open();
    expect(
      screen.queryByRole("heading", { name: "Switch a venue off" }),
    ).toBeNull();
    const key = screen.getByRole("group", {
      name: "Venue fans used for this draft",
    });
    expect(key.parentElement!.textContent).toContain(
      "These venues' fans are the signal: the acts won't necessarily play there.",
    );
    expect(key.parentElement!.textContent).not.toContain(
      "Untick a venue",
    );
  });

  it("ends on who decides, then one way on", () => {
    open();
    const end = screen.getByRole("region", { name: "Who decides" });
    expect((end).textContent).toContain(
      "Undercard drafts. The buyer makes every call.",
    );
    expect(
      within(end)
        .getByRole("link", { name: "Draft your own festival" })
        .getAttribute("href"),
    ).toBe("/your-festival");
  });
});
