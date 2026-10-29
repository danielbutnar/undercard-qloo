// @vitest-environment jsdom
// WS12 item 10: an about line in the footer of every page: built for the Qloo hackathon, Qloo's
// data, the model's name, and where the AI usage is written up (README's AI usage section).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { modelName, SiteFooter } from "@/components/site-footer";
import { AI_MODEL } from "@/server/ai";

afterEach(cleanup);

describe("the footer's about line (WS12 item 10)", () => {
  it("names the model as people read it, from its id", () => {
    expect(modelName("claude-sonnet-5-5")).toBe("Claude Sonnet 5.5");
    expect(modelName("claude-opus-4-1")).toBe("Claude Opus 4.1");
  });

  it("says what Undercard was built for, whose data and which model, and where AI use is written up", () => {
    render(<SiteFooter model={AI_MODEL} />);
    const text = screen.getByRole("contentinfo").textContent ?? "";
    expect(text).toContain("Built for the Qloo Agentic Hackathon");
    expect(text).toContain("taste data from Qloo");
    expect(text).toContain(`${modelName(AI_MODEL)} (${AI_MODEL})`);
    expect(text).toContain("README's AI usage section");
  });
});
