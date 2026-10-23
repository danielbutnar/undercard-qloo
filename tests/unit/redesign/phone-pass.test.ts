// WS9's phone pass, at 375 px: How it works follows one act with a first-screen row riding its
// rung chart. Below 560 px a phone's rows show their cover in a "sleeve" column (Daniel's brief
// of 2026-10-22, item 5) and the followed row takes four columns, but it kept its three named
// areas: the act's name and genres fell into the cover's 36 px column, a word to a line, and the
// row grew out over the step buttons. jsdom lays nothing out, so the rules are read from the
// stylesheet.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync("src/components/chart/chart.css", "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Every media block whose query matches, as [query, body]. */
function mediaBlocks(query: RegExp): string[] {
  const blocks: string[] = [];
  const at = /@media([^{]+)\{/g;
  let match: RegExpExecArray | null;
  while ((match = at.exec(CSS))) {
    let depth = 1;
    let i = at.lastIndex;
    while (depth > 0 && i < CSS.length) {
      if (CSS[i] === "{") depth++;
      if (CSS[i] === "}") depth--;
      i++;
    }
    if (query.test(match[1])) blocks.push(CSS.slice(at.lastIndex, i - 1));
  }
  return blocks;
}

/** The declarations a selector gets inside the blocks given. */
function declared(blocks: string[], selector: string): string {
  const found: string[] = [];
  for (const body of blocks)
    for (const [, selectors, declarations] of body.matchAll(
      /([^{}]+)\{([^{}]*)\}/g,
    ))
      if (
        selectors
          .split(",")
          .map((part) => part.trim().replace(/\s+/g, " "))
          .includes(selector)
      )
        found.push(declarations.replace(/\s+/g, " "));
  return found.join(" ");
}

describe("How it works at 375 px", () => {
  it("gives the followed row's cover its own column in the phone's grid", () => {
    const phone = mediaBlocks(/max-width: 559px/);
    // A phone's rows show their cover in the "sleeve" area...
    expect(declared(phone, ".chart-app .row .row-sleeve")).toMatch(
      /grid-area: sleeve/,
    );
    // ...and the followed row, in four columns there, names that area too.
    const followed = declared(phone, ".chart-app .how-row .row");
    expect(followed).toMatch(
      /grid-template-columns: 70px 36px minmax\(0, 1fr\) 30px/,
    );
    expect(followed).toMatch(
      /grid-template-areas: "place sleeve who venue" "place sleeve climb venue"/,
    );
  });
});
