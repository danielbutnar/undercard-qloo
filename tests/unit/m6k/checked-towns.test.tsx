// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YourFestival } from "@/components/your-festival";
import { CHECKED_TOWNS } from "@/lib/checked-towns";
import { YourBriefSchema } from "@/lib/your-festival";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the checked towns", () => {
  it("are names and countries only, each a brief Your festival accepts, with no repeats", () => {
    expect(CHECKED_TOWNS.length).toBeGreaterThanOrEqual(19);
    const keys = CHECKED_TOWNS.map((town) => `${town.city}|${town.region}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const town of CHECKED_TOWNS) {
      expect(Object.keys(town).sort()).toEqual(["city", "country", "region"]);
      expect(
        YourBriefSchema.safeParse({
          city: town.city,
          region: town.region,
          headliners: ["A", "B"],
        }).success,
      ).toBe(true);
    }
    expect(keys).toContain("Boise|Idaho");
    expect(keys).toContain("Tallinn|Estonia");
  });

  it("live in one file with no Qloo data in it", () => {
    const source = readFileSync("src/lib/checked-towns.ts", "utf8");
    expect(source).not.toMatch(/urn:|entity_id|affinity|popularity/i);
  });
});

describe("Your festival opens on the checked towns", () => {
  const ndjson = () =>
    new Response(JSON.stringify({ type: "done", calls: 0, ms: 0 }) + "\n", {
      headers: { "content-type": "application/x-ndjson" },
    });

  it("lists each town with its country, and one click runs it with the headliners in the form", async () => {
    const fetch = vi.fn(async () => ndjson());
    vi.stubGlobal("fetch", fetch);
    render(<YourFestival />);
    const list = screen.getByRole("list", {
      name: "Towns Undercard has already read",
    });
    const tallinn = within(list).getByRole("button", {
      name: /^Tallinn, Estonia/,
    });
    expect(within(list).getAllByRole("button")).toHaveLength(
      CHECKED_TOWNS.length,
    );
    fireEvent.click(tallinn);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).brief).toEqual({
      city: "Tallinn",
      region: "Estonia",
      headliners: ["Khruangbin", "Japanese Breakfast"],
    });
  });

  it("keeps free text below the list only when it's on", () => {
    render(<YourFestival freeText />);
    expect(screen.getByLabelText("Town")).toBeTruthy();
    cleanup();
    render(<YourFestival freeText={false} />);
    expect(screen.queryByLabelText("Town")).toBeNull();
    expect(
      screen.getByRole("list", { name: "Towns Undercard has already read" }),
    ).toBeTruthy();
  });
});
