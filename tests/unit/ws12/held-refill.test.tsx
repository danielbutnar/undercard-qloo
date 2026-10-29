// @vitest-environment jsdom
// Daniel, 29 Oct (10:40), "Never silent": a refill or a redraft served from the rankings a 2.0
// build already holds makes no Qloo call, and says so, in the trace and on the setlist: "Refilled
// from the rankings already read: no new Qloo call." A refill that did call Qloo shows its calls
// as before. Synthetic data: invented acts and venues, no Qloo data.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { HELD_REFILL_LINE } from "@/lib/agent-words";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
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

async function refill(answer: (unavailableId: string) => string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) =>
      url === "/api/refill"
        ? new Response(
            answer(JSON.parse(String(init?.body)).unavailableId),
            NDJSON,
          )
        : new Response(null, { status: 404 }),
    ),
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
  fireEvent.click(screen.getByRole("button", { name: "Fee" }));
  await within(bill).findByRole("article", { name: "Sego Lily" });
  return {
    trace: () =>
      screen.getByRole("complementary", { name: "Qloo calls" }).textContent,
    setlist: () =>
      screen.getByRole("region", { name: "The AI agent's setlist" })
        .textContent,
  };
}

const LF = String.fromCharCode(10);
// The held refill: the server's status line in place of the call, then the act, no call.
const held = (unavailableId: string) =>
  syntheticRefillStream(unavailableId)
    .split(LF)
    .map((line) => {
      if (!line.trim()) return line;
      const event = JSON.parse(line);
      return event.type === "call"
        ? JSON.stringify({ type: "status", text: HELD_REFILL_LINE })
        : event.type === "done"
          ? JSON.stringify({ ...event, calls: 0 })
          : line;
    })
    .join(LF);

describe("a refill from the rankings already read (Daniel, 10:40)", () => {
  it("says so in the trace and on the setlist, in Daniel's words", async () => {
    expect(HELD_REFILL_LINE).toBe(
      "Refilled from the rankings already read: no new Qloo call.",
    );
    const { trace, setlist } = await refill(held);
    expect(trace()).toContain(HELD_REFILL_LINE);
    expect(setlist()).toContain(HELD_REFILL_LINE);
    expect(setlist()).not.toContain(`The AI agent: ${HELD_REFILL_LINE}`);
  });

  it("isn't said of a refill that called Qloo, whose calls show as before", async () => {
    const { trace, setlist } = await refill(syntheticRefillStream);
    expect(trace()).not.toContain(HELD_REFILL_LINE);
    expect(setlist()).not.toContain(HELD_REFILL_LINE);
  });
});
