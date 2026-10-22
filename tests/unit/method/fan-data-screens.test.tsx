// @vitest-environment jsdom
// WS2, no fan data, on screen: How it works' "The AI agent's choices" box and Watch say Qloo had
// no fan data for a venue whose runs are the headliners-only ranking, and keep today's words for
// a venue that was read and moved nothing; a venue the switch sentence names isn't said twice.
// Invented data only.
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
import type { FirstBill } from "@/lib/first-bill";
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

const NO_FAN =
  "Qloo had no fan data for this venue, so its ranking stays the headliners' own.";
const COTTONWOOD = syntheticSavedBuild().context.anchors.mid![2];
// The switch build's venue A, read before the planner named Fort Street Ballroom.
const LINDEN = syntheticSwitchBuild().context.anchors.mid![1];

async function bill(build: SavedBuild, noFanData?: string[]) {
  const first = (await readFirstBill(
    { latest: async () => build },
    build.festivalId,
  ))!;
  return { ...first, ...(noFanData ? { noFanData } : {}) } as FirstBill;
}

function answer(stream = "") {
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
  async function choices(first: FirstBill) {
    answer();
    render(
      <MethodPage
        story={methodStory(SAGEBRUSH_SOUND, first)}
        videoUrl={null}
      />,
    );
    return screen.getByRole("region", { name: "The AI agent's choices" });
  }

  it("says Qloo had no fan data for a venue whose runs are the headliners' own ranking", async () => {
    const box = await choices(
      await bill(syntheticSavedBuild(), [COTTONWOOD.entityId]),
    );
    expect(
      within(box).getByText(
        "Cottonwood Social Hall: the agent read it too, but Qloo had no fan data for it.",
      ),
    ).toBeTruthy();
    expect(box.textContent).not.toMatch(/moved no act/);
  });

  it("keeps its words for a venue that was read and moved nothing", async () => {
    const box = await choices(await bill(syntheticSavedBuild()));
    expect(
      within(box).getByText(
        "Cottonwood Social Hall: the agent read its fans too, and they moved no act onto the lineup.",
      ),
    ).toBeTruthy();
  });

  it("says it in the switch sentence, and drops the venue's own line, when the switch names it", async () => {
    const box = await choices(
      await bill(syntheticSwitchBuild(), [LINDEN.entityId]),
    );
    expect(
      within(box).getByText(
        "Qloo had no fan data for Linden Street Annex, so the agent read Fort Street Ballroom; 3 acts come from that read.",
      ),
    ).toBeTruthy();
    expect(box.textContent).not.toMatch(/Linden Street Annex: the agent/);
  });

  it("drops the venue's own line under the old switch sentence too", async () => {
    const box = await choices(await bill(syntheticSwitchBuild()));
    expect(
      within(box).getByText(
        "Linden Street Annex's fans moved no act onto the lineup, so the agent read Fort Street Ballroom; 3 acts come from that read.",
      ),
    ).toBeTruthy();
    expect(box.textContent).not.toMatch(/Linden Street Annex: the agent/);
  });
});

describe("Watch", () => {
  async function watch(
    festival: Festival,
    saved: SavedBuild,
    first: FirstBill,
  ) {
    answer(syntheticReplayStream(saved));
    render(<FestivalScreen festival={festival} firstBill={first} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Watch how it picked these acts" }),
    );
    return screen.getByRole("region", { name: "Undercard draft" });
  }
  // Watch paces its editions in real time (0.8 s a headliners' list, 1.6 s a venue's).
  const at = async (region: HTMLElement, title: string) =>
    waitFor(() => expect(within(region).getByText(title)).toBeTruthy(), {
      timeout: 12_000,
    });

  it("says Qloo had no fan data for a venue's edition in place of its no-act line", async () => {
    const saved = syntheticSavedBuild();
    const region = await watch(
      SAGEBRUSH_SOUND,
      saved,
      await bill(saved, [COTTONWOOD.entityId]),
    );
    await at(region, "+ Fort Street Ballroom's fans");
    expect(within(region).queryByText(NO_FAN)).toBeNull();
    await at(region, "+ Cottonwood Social Hall's fans");
    expect(within(region).getByText(NO_FAN)).toBeTruthy();
    expect(region.textContent).not.toMatch(/no act climbs/);
  });

  it("says it in the switch sentence on the venue the agent read next", async () => {
    const nashville = townBySlug("nashville")!.festival;
    const saved = syntheticTownBuild("nashville", nashville.id);
    const region = await watch(
      nashville,
      saved,
      await bill(saved, [LINDEN.entityId]),
    );
    await at(region, "+ Fort Street Ballroom's fans");
    expect(
      within(region).getByText(
        "Qloo had no fan data for Linden Street Annex, so the agent read Fort Street Ballroom; 3 acts come from that read.",
      ),
    ).toBeTruthy();
  });
});
