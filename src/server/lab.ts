import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { labEnabled, labPlaces, type LabBill } from "@/lib/lab";
import type { BuildStore } from "./build-store";
import { readFirstBill } from "./first-bill";

/**
 * The festival's latest saved build for the lab, or null when none is saved or the store doesn't
 * answer in time. It only reads: no Qloo or Claude call, and the latest pointer never moves.
 */
export async function readLabBill(
  store: Pick<BuildStore, "latest">,
  festivalId: string,
  { timeoutMs = 5000 }: { timeoutMs?: number } = {},
): Promise<LabBill | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const saved = await Promise.race([store.latest(festivalId), timeout]);
    if (!saved) return null;
    const first = await readFirstBill(
      { latest: async () => saved },
      festivalId,
    );
    if (!first) return null;
    return {
      first,
      places: labPlaces(saved.lineup.acts, saved.context.baselines),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Where scripts/lab-capture.mjs writes the stills and clips: git-ignored, never deployed. */
export const LAB_SHOTS = join(process.cwd(), ".design", "lab");

const SHOT = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(png|webm|json)$/;
const TYPES = {
  png: "image/png",
  webm: "video/webm",
  json: "application/json",
} as const;

/** One still or clip from the lab folder, only while the lab is open; anything else is a 404. */
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
    const body = await readFile(join(root, name));
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
