import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { labEnabled } from "@/lib/lab";

/**
 * Where scripts/lab-capture.mjs writes the lab's stills and clips: ignored by git and kept out of
 * every build. The ignore comments stop Turbopack tracing the folder into the server output, so a
 * build made on this machine can't carry them (scripts/trace-check.mjs checks it after a build).
 */
export const LAB_SHOTS = join(
  /*turbopackIgnore: true*/ process.cwd(),
  ".design",
  "lab",
);

const SHOT = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(png|webm|json)$/;
const TYPES = {
  png: "image/png",
  webm: "video/webm",
  json: "application/json",
} as const;

/** One still, clip or clip timing from the lab folder, only while the lab is open; else a 404. */
export async function labShot(
  name: string,
  {
    root = LAB_SHOTS,
    enabled = labEnabled(),
  }: { root?: string; enabled?: boolean } = {},
): Promise<Response> {
  const match = SHOT.exec(name);
  if (!enabled || !match) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(
      /*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ root, name),
    );
    return new Response(new Uint8Array(body), {
      headers: {
        "content-type": TYPES[match[1] as keyof typeof TYPES],
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
