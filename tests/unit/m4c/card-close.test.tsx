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
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(cleanup);

describe("an open act's card", () => {
  it("carries its Close inside the card, beside the act's name", () => {
    render(
      <FestivalScreen festival={SAGEBRUSH_SOUND} firstBill={FIRST_BILL} />,
    );
    fireEvent.click(
      within(screen.getByRole("region", { name: "Undercard draft" })).getByRole(
        "button",
        { name: "Marisol Vey" },
      ),
    );
    const card = within(
      screen.getByRole("region", { name: "Act card" }),
    ).getByRole("article", { name: "Marisol Vey" });
    fireEvent.click(
      within(card).getByRole("button", { name: "Close the card" }),
    );
    expect(screen.queryByRole("region", { name: "Act card" })).toBeNull();
  });
});
