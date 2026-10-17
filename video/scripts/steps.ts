// The demo path from SPEC.md section 3, one entry per "step" segment in script.json (same ids).
// The locators are the ones tests/e2e/demo-path.spec.ts uses, so capture and e2e break together.
// Capture only ever replays the saved build: no step presses "Run the agent live instead".
import type { Locator, Page } from "playwright";

export const VIEWPORT = { width: 1440, height: 810 };

export type Step = {
  id: string; // the matching segment id in script.json
  url?: string; // path to open before the step, relative to CAPTURE_URL
  target?: (page: Page) => Locator; // what the cursor moves to and acts on
  action?: "click" | "type" | "hover" | "none"; // default: click when there is a target
  text?: string; // for "type"
  submit?: boolean; // press Enter after typing
  until?: (page: Page) => Locator; // visible once the step's result is on screen
  focus?: (page: Page) => Locator; // what the camera settles on afterwards (default: the target)
  frames?: number; // stills of the result, for streaming output (default 1)
  frameEveryMs?: number; // gap between those stills (default 400)
};

const bill = (page: Page) =>
  page.getByRole("region", { name: "Undercard draft" });
const mid = (page: Page) => bill(page).getByRole("region", { name: /^Mid/ });
const card = (page: Page) => page.getByRole("region", { name: "Act card" });

export const steps: Step[] = [
  {
    id: "replay",
    url: "/",
    target: (page) =>
      page.getByRole("button", { name: "Watch the agent build it" }),
    until: (page) => page.getByText(/^Replayed the build saved/),
    focus: (page) => page.getByRole("list", { name: "Qloo calls" }),
    frames: 6,
    frameEveryMs: 350,
  },
  {
    id: "card",
    target: (page) =>
      mid(page).getByRole("article").first().getByRole("button").first(),
    until: (page) => card(page),
    focus: (page) => card(page),
  },
  {
    id: "refill",
    target: (page) => card(page).getByRole("button", { name: "Unavailable" }),
    until: (page) => page.getByRole("list", { name: "Qloo calls" }).getByText(/Refill: /).last(),
    focus: (page) => mid(page),
    frames: 3,
    frameEveryMs: 400,
  },
  {
    id: "without",
    target: (page) =>
      page.getByRole("button", { name: "Without Qloo: the model's picks" }),
    until: (page) =>
      page
        .getByRole("region", { name: "Without Qloo: the model's picks" })
        .getByRole("article")
        .first(),
    focus: (page) =>
      page.getByRole("region", { name: "Without Qloo: the model's picks" }),
  },
];
