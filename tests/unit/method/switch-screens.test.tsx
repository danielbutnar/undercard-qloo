// @vitest-environment jsdom
// WS2 (b): the agent's switch on screen, from the saved trace only. How it works' "The AI
// agent's choices" box and Watch add one sentence where the saved build's planner switched
// venue, and nothing elsewhere; Watch's label for the agent's line is "The AI agent's plan:",
// with a one-line key under the first line that says "Anchors". Invented data only.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { MethodPage } from "@/components/method-page";
import type { Festival } from "@/lib/festival";
import { methodStory } from "@/lib/method-story";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { townBySlug } from "@/lib/towns";
import type { SavedBuild } from "@/server/build-store";
import { readFirstBill } from "@/server/first-bill";
import {
  syntheticReplayStream,
  syntheticSavedBuild,
  syntheticSwitchBuild,
  syntheticTownBuild,
  syntheticVenueSwitch,
} from "../../e2e/synthetic-build";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const SWITCH =
  "Linden Street Annex's fans moved no act onto the lineup, so the agent read Fort Street Ballroom; 3 acts come from that read.";
const KEY = "Anchors are the venues whose fans it reads.";
const NASHVILLE = townBySlug("nashville")!.festival;

const firstBill = (build: SavedBuild) =>
  readFirstBill({ latest: async () => build }, build.festivalId);

function answer(stream: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/venue-switch")
        ? Response.json(syntheticVenueSwitch())
        : url.startsWith("/api/undercard")
          ? new Response(stream, {
              headers: { "content-type": "application/x-ndjson" },
            })
          : new Response(null, { status: 404 }),
    ),
  );
}

describe("How it works' AI agent's choices", () => {
  const choices = async (build: SavedBuild) => {
    answer("");
    render(
      <MethodPage
        story={methodStory(SAGEBRUSH_SOUND, await firstBill(build))}
        videoUrl={null}
      />,
    );
    return screen.getByRole("region", { name: "The AI agent's choices" });
  };

  it("adds the switch where the saved trace shows one", async () => {
    expect(
      within(await choices(syntheticSwitchBuild())).getByText(SWITCH),
    ).toBeTruthy();
  });

  it("adds nothing where it doesn't", async () => {
    expect((await choices(syntheticSavedBuild())).textContent).not.toMatch(
      /so the agent read/,
    );
  });
});

describe("Watch", () => {
  async function watch(festival: Festival, saved: SavedBuild, stream: string) {
    answer(stream);
    render(
      <FestivalScreen festival={festival} firstBill={await firstBill(saved)} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Watch the AI agent build it" }),
    );
    return screen.getByRole("region", { name: "Undercard draft" });
  }
  // Watch paces its editions in real time (0.8 s a headliners' list, 1.6 s a venue's).
  const at = async (bill: HTMLElement, title: string) =>
    waitFor(() => expect(within(bill).getByText(title)).toBeTruthy(), {
      timeout: 12_000,
    });

  it("labels the agent's line as its plan, keys Anchors once, and says why it read the next venue", async () => {
    const saved = syntheticTownBuild("nashville", NASHVILLE.id);
    const bill = await watch(NASHVILLE, saved, syntheticReplayStream(saved));
    await at(bill, "+ The Lantern Room's fans");
    expect(
      within(bill).getByText(
        "The AI agent's plan: Anchors: The Lantern Room for both bands and Linden Street Annex for Mid, with Fort Street Ballroom as a backup.",
      ),
    ).toBeTruthy();
    expect(within(bill).getByText(KEY)).toBeTruthy();
    expect(within(bill).queryByText(SWITCH)).toBeNull();

    await at(bill, "+ Fort Street Ballroom's fans");
    expect(
      within(bill).getByText(
        "The AI agent's plan: Linden Street Annex lifted no act; try Fort Street Ballroom for both bands.",
      ),
    ).toBeTruthy();
    expect(within(bill).getByText(SWITCH)).toBeTruthy();
    expect(within(bill).queryByText(KEY)).toBeNull();
    expect(within(bill).queryByText(/^The AI agent: /)).toBeNull();
  });

  it("adds no sentence on a saved trace without a switch", async () => {
    const saved = syntheticSavedBuild();
    const bill = await watch(
      SAGEBRUSH_SOUND,
      saved,
      syntheticReplayStream(saved),
    );
    // Cottonwood Social Hall is the last of seven editions: wait for the fifth, then for it.
    await at(bill, "+ Fort Street Ballroom's fans");
    await at(bill, "+ Cottonwood Social Hall's fans");
    expect(
      within(bill).getByText(
        "The AI agent's plan: Try Cottonwood Social Hall for Mid as a third room.",
      ),
    ).toBeTruthy();
    expect(bill.textContent).not.toMatch(/so the agent read/);
    expect(within(bill).queryByText(KEY)).toBeNull();
  });

  it("adds no sentence to a run that isn't the saved build on screen", async () => {
    const saved = syntheticTownBuild("nashville", NASHVILLE.id);
    const live = syntheticReplayStream(saved).replace(
      '"replayed":true',
      '"replayed":false',
    );
    const bill = await watch(NASHVILLE, saved, live);
    await at(bill, "+ Fort Street Ballroom's fans");
    expect(bill.textContent).not.toMatch(/so the agent read/);
  });
});
