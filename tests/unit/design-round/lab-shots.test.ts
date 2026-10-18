// The lab's stills and clips stay in .design/lab (git-ignored) and are served only under `next dev`.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { labShot } from "@/server/lab-shots";

const roots: string[] = [];

function folder(): string {
  const root = mkdtempSync(join(tmpdir(), "lab-shots-"));
  roots.push(root);
  writeFileSync(join(root, "chart-1440.png"), Buffer.from([137, 80, 78, 71]));
  writeFileSync(
    join(root, "chart-build.webm"),
    Buffer.from([26, 69, 223, 163]),
  );
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("lab stills and clips", () => {
  it("serves a still and a clip from the lab folder", async () => {
    const root = folder();
    const still = await labShot("chart-1440.png", { root, enabled: true });
    expect(still.status).toBe(200);
    expect(still.headers.get("content-type")).toBe("image/png");
    const clip = await labShot("chart-build.webm", { root, enabled: true });
    expect(clip.status).toBe(200);
    expect(clip.headers.get("content-type")).toBe("video/webm");
  });

  it("serves a clip's timing, so the lab page plays the build and not the page load", async () => {
    const root = folder();
    writeFileSync(join(root, "chart-build.json"), '{"start":4.1,"end":18.9}\n');
    const timing = await labShot("chart-build.json", { root, enabled: true });
    expect(timing.status).toBe(200);
    expect(timing.headers.get("content-type")).toBe("application/json");
    expect(await timing.json()).toEqual({ start: 4.1, end: 18.9 });
  });

  it("answers 404 when the lab is closed", async () => {
    const response = await labShot("chart-1440.png", {
      root: folder(),
      enabled: false,
    });
    expect(response.status).toBe(404);
  });

  it("serves nothing outside the folder and no other kind of file", async () => {
    const root = folder();
    for (const name of [
      "../.env.local",
      "..\\.env.local",
      "chart.svg",
      "Chart-1440.png",
      ".env",
    ]) {
      expect((await labShot(name, { root, enabled: true })).status).toBe(404);
    }
  });

  it("answers 404 for a still that hasn't been shot", async () => {
    expect(
      (await labShot("desk-1440.png", { root: folder(), enabled: true }))
        .status,
    ).toBe(404);
  });
});
