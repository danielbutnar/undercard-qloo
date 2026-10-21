import { describe, expect, it } from "vitest";
import { formFor, sleeveFor, sleeveWords } from "@/lib/sleeve";

describe("an act's sleeve", () => {
  it("gives every genre word the saved builds use its own form, most specific first", () => {
    expect(formFor("Indie Pop")).toBe("dots");
    expect(formFor("Dream Pop")).toBe("rings");
    expect(formFor("Experimental Pop")).toBe("shards");
    expect(formFor("Indie")).toBe("crosses");
    expect(formFor("Indie Rock")).toBe("bars");
    expect(formFor("Alternative Rock")).toBe("blocks");
    expect(formFor("Rock")).toBe("stripes");
    expect(formFor("Psychedelic Rock")).toBe("spiral");
    expect(formFor("Psychedelic")).toBe("spiral");
    expect(formFor("Soul")).toBe("arcs");
    expect(formFor("Funk")).toBe("waves");
    expect(formFor("Lo-Fi")).toBe("stipple");
    expect(formFor("Instrumental")).toBe("staff");
    expect(formFor("Shoegaze")).toBe("fade");
  });

  it("draws a word the grammar doesn't know the same way every time", () => {
    expect(formFor("Zydeco")).toBe(formFor("zydeco"));
  });

  it("is the same sleeve for the same act, turned by its id alone", () => {
    const a = sleeveFor(["Indie Pop", "Soul"], "act-1");
    expect(sleeveFor(["Indie Pop", "Soul"], "act-1")).toEqual(a);
    expect(a.first).toBe("dots");
    expect(a.second).toBe("arcs");
    expect(a.turn).toBeGreaterThanOrEqual(0);
    expect(a.turn).toBeLessThan(4);
  });

  it("says what it is in words for screen readers", () => {
    expect(sleeveWords(["Indie Pop", "Soul"])).toBe(
      "A sleeve drawn from Indie Pop (round forms) and Soul (warm arcs).",
    );
  });
});
