// @vitest-environment jsdom
// WS12 item 5: Without Qloo as a contrast, not a scorecard. The model's own picks keep their
// reasons (WS8); the AI's local pick (WS13.5), the model's own knowledge of the town checked on
// Qloo, sits beside them in WS13's own box, so its rules (a pick above both tiers, the add
// action) are WS13's wherever it shows. Synthetic data: invented acts, no Qloo data.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalScreen } from "@/components/festival-screen";
import { LOCAL_PICK_LABEL } from "@/lib/agent-words";
import type { LocalPick } from "@/lib/local-pick";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { syntheticLlmOnly } from "../../e2e/synthetic-build";
import { FIRST_BILL } from "../m4b/first-bill-fixture";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const PICK: LocalPick = {
  entityId: "00000000-0000-4000-8000-000000000901",
  name: "Sagebrush Porch Band",
  asked: "Sagebrush Porch Band",
  why: "A local band the town's venues book often.",
  popularity: 0.6,
  band: "opener",
  range: "in",
  sharedTags: [],
} as LocalPick;

function open() {
  const { lineup } = syntheticLlmOnly();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === "/api/llm-only"
        ? Response.json({ lineup, cached: true })
        : new Response("", { status: 404 }),
    ),
  );
  render(
    <FestivalScreen
      festival={SAGEBRUSH_SOUND}
      firstBill={{ ...FIRST_BILL, localPicks: [PICK] }}
    />,
  );
}

describe("Without Qloo, as a contrast (WS12 item 5)", () => {
  it("sets the AI's local pick beside the model's own picks, in WS13's box", async () => {
    open();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Without Qloo: an AI model's picks alone",
      }),
    );
    const model = await screen.findByRole("region", {
      name: "Without Qloo: an AI model's picks alone",
    });
    const box = within(model).getByRole("region", { name: LOCAL_PICK_LABEL });
    expect(box.textContent).toContain("Sagebrush Porch Band");
  });
});
