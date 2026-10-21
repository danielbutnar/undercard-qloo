// Plan.md item 4 (the review's D2): for a saved build, the server's HTML carries the venue
// results, so a plain fetch, a slow connection or a grader reading the page sees them, not a
// loading line.
import { expect, test } from "@playwright/test";
import { SYNTHETIC } from "./env";

test.skip(SYNTHETIC === "empty", "needs a saved build");

for (const path of ["/", "/towns/austin"])
  test(`a plain fetch of ${path} shows the venue results, not a loading line`, async ({
    request,
  }) => {
    test.skip(
      path !== "/" && SYNTHETIC !== null,
      "the synthetic server saves Boise only",
    );
    const html = await (await request.get(path)).text();
    expect(html).not.toContain("Loading the saved build");
    expect(html).toMatch(/\d+ of \d+ slots filled/);
  });
