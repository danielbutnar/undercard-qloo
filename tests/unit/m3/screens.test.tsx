// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../../fixtures/lineup.synthetic.json";
import { ActCard } from "@/components/act-card";
import { FestivalScreen } from "@/components/festival-screen";
import { LlmOnlyBoard } from "@/components/llm-only-board";
import { LineupSchema } from "@/lib/lineup";
import type { LlmOnlyLineup } from "@/lib/llm-only";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const { acts } = LineupSchema.parse(fixture);
const llmLineup: LlmOnlyLineup = {
  festivalId: "sagebrush-sound",
  createdAt: "2026-10-15T14:02:00.000Z",
  picks: Array.from({ length: 10 }, (_, i) => ({
    name: `Model Pick ${i + 1}`,
    note: `A synthetic reason ${i + 1}.`,
  })),
};

describe("LlmOnlyBoard", () => {
  it("labels the model's picks 'No Qloo data', with no affinity, fee band or local link", () => {
    render(
      <LlmOnlyBoard
        state={{ status: "ready", lineup: llmLineup, error: null }}
      />,
    );
    const board = screen.getByRole("region", { name: /LLM only/ });
    expect(within(board).getByText("No Qloo data")).toBeTruthy();
    const cards = within(board).getAllByRole("article");
    expect(cards).toHaveLength(10);
    const first = cards[0];
    expect(within(first).getByText("Model Pick 1")).toBeTruthy();
    expect(within(first).getAllByText("—")).toHaveLength(3);
    expect(within(first).getByText(/No local link/)).toBeTruthy();
    expect(within(first).getByText(/A synthetic reason 1\./)).toBeTruthy();
  });

  it("shows a loading line and an error", () => {
    const { rerender } = render(
      <LlmOnlyBoard state={{ status: "loading", lineup: null, error: null }} />,
    );
    expect(screen.getByText("Asking the model, without Qloo…")).toBeTruthy();
    rerender(
      <LlmOnlyBoard
        state={{
          status: "error",
          lineup: null,
          error: "The model didn't answer.",
        }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "The model didn't answer.",
    );
  });
});

describe("ActCard with Unavailable", () => {
  it("marks the act unavailable from its card", () => {
    const onUnavailable = vi.fn();
    render(<ActCard act={acts[0]} onUnavailable={onUnavailable} />);
    fireEvent.click(screen.getByRole("button", { name: "Unavailable" }));
    expect(onUnavailable).toHaveBeenCalledWith(acts[0]);
  });

  it("stamps an unavailable act and takes its button away", () => {
    render(<ActCard act={acts[0]} unavailable onUnavailable={vi.fn()} />);
    const card = screen.getByRole("article", { name: "Hollow Pines" });
    expect(
      within(card).getByText("Unavailable", { selector: "p" }),
    ).toBeTruthy();
    expect(within(card).queryByRole("button")).toBeNull();
  });
});

describe("FestivalScreen modes", () => {
  it("flips to the LLM-only lineup and back", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ lineup: llmLineup, cached: true }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<FestivalScreen festival={SAGEBRUSH_SOUND} />);

    fireEvent.click(screen.getByRole("button", { name: "LLM only" }));
    await waitFor(() => expect(screen.getByText("No Qloo data")).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith(
      "/api/llm-only",
      expect.objectContaining({ method: "POST" }),
    );
    expect(
      screen
        .getByRole("button", { name: "LLM only" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.queryByRole("region", { name: /^Mid/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Qloo" }));
    expect(screen.getByRole("region", { name: /^Mid/ })).toBeTruthy();
    expect(screen.queryByText("No Qloo data")).toBeNull();
  });
});
