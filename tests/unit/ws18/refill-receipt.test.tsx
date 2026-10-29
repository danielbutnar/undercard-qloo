// @vitest-environment jsdom
// WS18 item 3 (Daniel, 29 Oct): after Unavailable, a receipt on the poster names the act that
// went and why, the act that took its slot with its place and its mark, and where it came from,
// with Undo; the replacement stays marked until the next action. The card's reasons say that
// Undercard can't see tour dates or contracts. Synthetic data only: invented acts and venues.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import { ActCard } from "@/components/act-card";
import { FestivalScreen } from "@/components/festival-screen";
import { HELD_REFILL_LINE } from "@/lib/agent-words";
import { LineupSchema } from "@/lib/lineup";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import type { UnavailableReason } from "@/lib/unavailable";
import {
  syntheticRefillStream,
  syntheticSavedBuild,
} from "../../e2e/synthetic-build";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const saved = syntheticSavedBuild();
const BILL = { ...FIRST_BILL, trace: saved.trace, notes: saved.notes };
const NDJSON = { headers: { "content-type": "application/x-ndjson" } };
const LF = String.fromCharCode(10);

type Answer = (unavailableId: string, reason?: UnavailableReason) => string;
/** The synthetic refill with each of its events changed by `edit`. */
const edited =
  (edit: (event: Record<string, unknown>) => Record<string, unknown>): Answer =>
  (unavailableId, reason) =>
    syntheticRefillStream(unavailableId, reason)
      .split(LF)
      .map((line) =>
        line.trim() ? JSON.stringify(edit(JSON.parse(line))) : line,
      )
      .join(LF);
// From the rankings already read: the server's status line in place of the call, and no call.
const held = edited((event) =>
  event.type === "call"
    ? { type: "status", text: HELD_REFILL_LINE }
    : event.type === "done"
      ? { ...event, calls: 0 }
      : event,
);

async function unavailable(
  reason: "Radius clause" | "Routing" | "Fee",
  answer: Answer = syntheticRefillStream,
) {
  const asked: { popularity?: number; reason?: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url !== "/api/refill") return new Response(null, { status: 404 });
      const body = JSON.parse(String(init?.body));
      asked.push(body);
      return new Response(answer(body.unavailableId, body.reason), NDJSON);
    }),
  );
  render(<FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={BILL} />);
  const bill = screen.getByRole("region", { name: "Undercard draft" });
  fireEvent.click(within(bill).getByRole("button", { name: "Hollow Pines" }));
  fireEvent.click(
    within(screen.getByRole("region", { name: "Act card" })).getByRole(
      "button",
      { name: "Unavailable" },
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: reason }));
  await within(bill).findByRole("article", { name: "Sego Lily" });
  return { bill, asked };
}

const receipt = (bill: HTMLElement) =>
  within(bill).queryByRole("status", { name: "The last refill" });
/** The act's row on the poster (an open card is an article with its name too). */
const row = (bill: HTMLElement, name: string) =>
  bill.querySelector<HTMLElement>(`.poster-act[aria-label="${name}"]`);
const marked = (bill: HTMLElement, name: string) =>
  row(bill, name)!.classList.contains("is-replacement");

describe("the refill's receipt on the poster (WS18 item 3)", () => {
  it("names the act that went and why, the act in its slot and where it came from, with Undo", async () => {
    const { bill, asked } = await unavailable("Routing");
    const line = receipt(bill)!;
    expect(
      within(line).getByText(
        "Hollow Pines out (routing) → Sego Lily, 12th, ↑13 · from 1 new Qloo call",
      ),
    ).toBeTruthy();
    expect(within(line).getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(marked(bill, "Sego Lily")).toBe(true);
    // The request carries the act's popularity, which a fee refill steers below.
    const gone = BILL.acts.find((act) => act.name === "Hollow Pines")!;
    expect(asked[0]).toMatchObject({
      reason: "routing",
      popularity: gone.popularity,
    });
  });

  it("says when the slot came from the rankings already read", async () => {
    const { bill } = await unavailable("Fee", held);
    expect(
      within(receipt(bill)!).getByText(
        "Hollow Pines out (fee) → Sego Lily, 12th, ↑13 · from the rankings already read, no new Qloo call",
      ),
    ).toBeTruthy();
  });

  it("says when a fee refill found no act below the replaced act's popularity", async () => {
    const { bill } = await unavailable(
      "Fee",
      edited((event) =>
        event.type === "refill" ? { ...event, feeFallback: true } : event,
      ),
    );
    expect(receipt(bill)!.textContent).toContain(
      "· no act below Hollow Pines's popularity passed: the strongest that does took the slot",
    );
  });

  it("puts the act back on Undo", async () => {
    const { bill } = await unavailable("Radius clause");
    fireEvent.click(
      within(receipt(bill)!).getByRole("button", { name: "Undo" }),
    );
    expect(row(bill, "Hollow Pines")?.classList.contains("is-gone")).toBe(
      false,
    );
    expect(row(bill, "Sego Lily")).toBeNull();
    expect(receipt(bill)).toBeNull();
  });

  it("keeps the replacement marked until the next action", async () => {
    const { bill } = await unavailable("Routing");
    // Opening an act's card only reads it: nothing on the bill changes.
    fireEvent.click(within(bill).getByRole("button", { name: "Sego Lily" }));
    expect(marked(bill, "Sego Lily")).toBe(true);
    expect(receipt(bill)).not.toBeNull();
    // Keep is the next action: the mark and the receipt go.
    fireEvent.click(
      within(screen.getByRole("region", { name: "Act card" })).getByRole(
        "button",
        { name: "Keep" },
      ),
    );
    expect(marked(bill, "Sego Lily")).toBe(false);
    expect(receipt(bill)).toBeNull();
  });
});

describe("the card's reasons (WS18 item 3)", () => {
  it("say Undercard can't see tour dates or contracts", () => {
    const { acts } = LineupSchema.parse(fixture);
    render(<ActCard act={acts[0]} onUnavailable={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Unavailable" }));
    expect(
      within(
        screen.getByRole("group", { name: "Why is it unavailable?" }),
      ).getByText(
        "Undercard can't see tour dates or contracts, so the reason goes on the receipt and in the CSV.",
      ),
    ).toBeTruthy();
  });
});
