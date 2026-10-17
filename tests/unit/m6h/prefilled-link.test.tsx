// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YourFestival } from "@/components/your-festival";
import { briefFromSearch, yourFestivalHref } from "@/lib/your-festival";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("a pre-filled Your festival link", () => {
  it("is built from a town and two headliners, and read back the same", () => {
    const href = yourFestivalHref({
      city: "Tallinn",
      region: "Estonia",
      headliners: ["Khruangbin", "Japanese Breakfast"],
    });
    expect(href).toBe(
      "/your-festival?town=Tallinn&region=Estonia&headliner=Khruangbin&headliner=Japanese+Breakfast",
    );
    expect(briefFromSearch(href.split("?")[1])).toEqual({
      city: "Tallinn",
      region: "Estonia",
      first: "Khruangbin",
      second: "Japanese Breakfast",
    });
  });

  it("keeps only what fits the form's fields", () => {
    expect(briefFromSearch(`town=${"x".repeat(90)}&headliner=A`)).toEqual({
      city: "x".repeat(60),
      region: "",
      first: "A",
      second: "",
    });
    expect(briefFromSearch("")).toBeNull();
  });

  it("fills the form and runs nothing until the visitor presses the button", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    // The page reads the link's query on the server and hands the form its values.
    render(
      <YourFestival
        linked={briefFromSearch(
          "town=Cluj-Napoca&headliner=Khruangbin&headliner=Japanese%20Breakfast",
        )}
      />,
    );
    await waitFor(() =>
      expect((screen.getByLabelText("Town") as HTMLInputElement).value).toBe(
        "Cluj-Napoca",
      ),
    );
    expect(
      (screen.getByLabelText("First headliner") as HTMLInputElement).value,
    ).toBe("Khruangbin");
    expect(
      (screen.getByLabelText("Second headliner") as HTMLInputElement).value,
    ).toBe("Japanese Breakfast");
    expect(screen.getByText(/filled in from your link/i)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetch).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: "Undercard draft" }),
    ).toBeNull();
  });
});
