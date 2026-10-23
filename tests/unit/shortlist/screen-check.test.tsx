// @vitest-environment jsdom
// WS4, the buyer's shortlist, step 4, on the page: at most 10 names, the check's Qloo calls
// counted and listed as the trace lists a build's (cached ones marked), and the limit's friendly
// message when the route refuses. The route is stubbed; invented names and ids.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShortlistScreen } from "@/components/shortlist/shortlist-screen";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { callBudget, checkShortlist } from "@/server/shortlist";
import { qlooWorld, savedBuild, shortlistQloo } from "./world";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const LIMIT =
  "You've used today's 5 shortlist checks from this network. Try again tomorrow (UTC).";

function paste(names: string[]) {
  fireEvent.change(
    screen.getByRole("textbox", { name: /acts you've been pitched/i }),
    { target: { value: names.join("\n") } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Sort them on Qloo" }));
}

describe("checking a shortlist on the page (WS4, step 4)", () => {
  it("asks for at most 10 names and sends nothing over that", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<ShortlistScreen />);

    paste(Array.from({ length: 11 }, (_, i) => `Invented Act ${i + 1}`));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Paste at most 10 names: this list has 11.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lists the check's Qloo calls like a build's: counted against the cap, cached ones marked", async () => {
    const world = qlooWorld(shortlistQloo());
    const names = ["Marigold Static", "Velvet Coyote", "Nobody Knows Us"];
    // Two of the searches are in the cache already.
    await callBudget({ ...world, cap: 14 }).run(
      names.slice(0, 2).map((query) => (qloo) => qloo.search({ query })),
    );
    const shortlist = await checkShortlist({
      festival: SAGEBRUSH_SOUND,
      build: savedBuild(),
      names,
      budget: callBudget({ ...world, cap: 14 }),
    });
    const fetch = vi.fn(async () => Response.json({ shortlist }));
    vi.stubGlobal("fetch", fetch);
    render(<ShortlistScreen />);

    paste(names);

    const calls = await screen.findByRole("complementary", {
      name: "Qloo calls",
    });
    expect(within(calls).getByText("5 of 14")).toBeTruthy();
    expect(
      within(calls).getByText(
        "7 calls: 5 made, 2 answered from the server's Qloo cache.",
      ),
    ).toBeTruthy();
    const listed = within(
      within(calls).getByRole("list", { name: "Qloo calls" }),
    ).getAllByRole("listitem");
    expect(
      listed.filter((item) => item.classList.contains("trace-call")),
    ).toHaveLength(7);
    expect(within(calls).getAllByText(/· cached/)).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith(
      "/api/shortlist",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ festival: SAGEBRUSH_SOUND.id, names }),
      }),
    );
  });

  it("shows the limit's friendly message and keeps the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: LIMIT, code: "limit" }, { status: 429 }),
      ),
    );
    render(<ShortlistScreen />);

    paste(["Velvet Coyote"]);

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(LIMIT),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Sort them on Qloo",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
