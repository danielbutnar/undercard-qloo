import { cacheLife } from "next/cache";
import type { TraceCall } from "@/lib/build-events";
import type { FirstBill } from "@/lib/first-bill";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import { venueHues } from "@/lib/venue-colours";
import { withArtistImages } from "@/server/artist-images";
import { withSplits } from "@/server/attribution";
import { serverBuildStore } from "@/server/deps";
import { withFanData } from "@/server/fan-data";
import { readFirstBill } from "@/server/first-bill";
import { townsOnShow } from "@/server/towns";
import { withVenueSwitch } from "@/server/venue-switch";
import {
  firstAct,
  liftingCall,
  setlistLines,
  type SetlistLine,
  type SetlistVenue,
} from "./words";

/**
 * WS12 step 0's data: the saved Boise build read exactly as the home page reads it (the synthetic
 * build under UNDERCARD_E2E_SYNTHETIC), plus the build's own trace and the AI agent's lines for
 * the setlist. Cached for a minute like the home page; nothing here calls Qloo or the model.
 */
export async function labFirstBill(): Promise<FirstBill | null> {
  "use cache";
  cacheLife("minutes");
  return withSplits(
    await withFanData(
      await withVenueSwitch(
        await withArtistImages(
          await readFirstBill(serverBuildStore(), SAGEBRUSH_SOUND.id),
        ),
        SAGEBRUSH_SOUND,
      ),
      SAGEBRUSH_SOUND,
    ),
    SAGEBRUSH_SOUND,
  );
}

export async function labTowns() {
  "use cache";
  cacheLife("minutes");
  return townsOnShow(serverBuildStore());
}

/** What the setlist, the ticket and the director's cut need beyond the first bill. */
export interface LabStory {
  buildId: string;
  createdAt: string;
  trace: TraceCall[];
  lines: SetlistLine[];
  closing: string[];
  /** The venues the agent read, in the order it read them. */
  venues: SetlistVenue[];
  /** Each venue's colour, as the poster sets it; null for a venue that lifted no act (grey). */
  hues: Record<string, number | null>;
  /** The venues Qloo had no fan data for, by entity id (src/lib/fan-data.ts). */
  noFanData: string[];
  /** The act the landing follows, by entity id, and the call that lifted it. */
  firstId: string | null;
  circled: number | null;
}

export async function labStory(): Promise<LabStory | null> {
  "use cache";
  cacheLife("minutes");
  const bill = await labFirstBill();
  const saved = await serverBuildStore().latest(SAGEBRUSH_SOUND.id);
  if (!bill || !saved || saved.id !== bill.build.id) return null;
  const bands = SAGEBRUSH_SOUND.feeBands;
  const seen = new Map<string, SetlistVenue>();
  for (const band of bands)
    for (const venue of saved.context.anchors[band.id] ?? [])
      if (!seen.has(venue.entityId))
        seen.set(venue.entityId, {
          entityId: venue.entityId,
          name: venue.name,
        });
  const venues = [...seen.values()];
  const ranked = venueHues(venues, bill.acts);
  const hues: Record<string, number | null> = {};
  for (const venue of venues)
    hues[venue.entityId] = bill.acts.some(
      (act) => act.anchorVenue.entityId === venue.entityId,
    )
      ? (ranked.get(venue.entityId) ?? null)
      : null;
  const { lines, closing } = setlistLines(saved.trace, {
    venues,
    bands,
    noFanData: bill.noFanData ?? [],
    notes: saved.notes ?? [],
  });
  const first = firstAct(bill.acts, bill.places ?? {}, bands);
  return {
    buildId: saved.id,
    createdAt: saved.createdAt,
    trace: saved.trace,
    lines,
    closing,
    venues,
    hues,
    noFanData: bill.noFanData ?? [],
    firstId: first?.entityId ?? null,
    circled: first ? liftingCall(saved.trace, first, venues, bands) : null,
  };
}
