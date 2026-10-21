// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YourFestival } from "@/components/your-festival";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ndjson = (events: unknown[]) =>
  new Response(events.map((event) => JSON.stringify(event)).join("\n") + "\n", {
    headers: { "content-type": "application/x-ndjson" },
  });

/** A judge's own run for a typed town that ends with the given code. */
function thinRun(code: string, message: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/venue-switch")
        ? new Response("", { status: 404 })
        : ndjson([
            {
              type: "build",
              id: "yours-1",
              createdAt: "2026-10-21T10:00:00.000Z",
              replayed: false,
            },
            { type: "error", code, message },
            { type: "done", calls: 3, ms: 900 },
          ]),
    ),
  );
  render(<YourFestival />);
  fireEvent.change(screen.getByLabelText("Town"), {
    target: { value: "Brighton" },
  });
  fireEvent.change(screen.getByLabelText("State or country"), {
    target: { value: "England" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Draft my undercard" }));
  return screen.findAllByRole("list", {
    name: /^Towns Undercard has already read/,
  });
}

describe("after a town Qloo can't find, or one with too few venues", () => {
  const states = [
    [
      "town-not-found",
      "Qloo couldn't find this town",
      "Qloo found no live-music places in Brighton, so there were no venues to read.",
    ],
    [
      "too-few-rooms",
      "Too few venues in this town",
      "Qloo lists only 1 live-music place in Brighton, too few for the AI agent to compare venues.",
    ],
  ] as const;

  for (const [code, title, message] of states)
    it(`offers the checked towns where Run the agent again was (${code})`, async () => {
      const offers = await thinRun(code, message);
      // Offered once, in the lead, under what happened: running the same town again can't help.
      expect(offers).toHaveLength(1);
      const lead = screen.getByRole("region", { name: "What Undercard does" });
      expect(within(lead).getByRole("heading", { name: title })).toBeTruthy();
      expect(lead.contains(offers[0])).toBe(true);
      expect(within(offers[0]).getAllByRole("button").length).toBeGreaterThan(
        0,
      );
      expect(
        screen.queryByRole("button", { name: "Run the agent again" }),
      ).toBeNull();
    });
});
