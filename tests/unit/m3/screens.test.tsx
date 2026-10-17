// @vitest-environment jsdom
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
import { LineupSchema } from "@/lib/lineup";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const { acts } = LineupSchema.parse(fixture);
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
