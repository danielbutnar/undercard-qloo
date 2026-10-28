"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { TownScene, type SceneVenue } from "@/components/chart/town-scene";
import type { Act } from "@/lib/lineup";
import type { SetlistVenue } from "./words";

const SHORT = "(min-width: 1100px) and (max-height: 720px)";

function subscribe(change: () => void) {
  const query = window.matchMedia(SHORT);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

/**
 * Step 0's stand-in for item 1's short-laptop fix. On a laptop 720 px tall or less, WS8 moved
 * Watch above the town, but FestivalScreen still keeps the town's bottom-left corner clear for
 * it, so in a shorter town the front venue's sign is hidden there. The build passes that corner
 * only where Watch sits over the town; until then this puts the same town (same seed, venues and
 * colours) in the town's slot without the corner, so the screenshot shows what the build will.
 */
export function ShortTown({
  seedKey,
  venues,
  acts,
  hues,
  noFanData,
}: {
  seedKey: string;
  venues: readonly SetlistVenue[];
  acts: readonly Act[];
  hues: Readonly<Record<string, number | null>>;
  noFanData: readonly string[];
}) {
  const short = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(SHORT).matches,
    () => false,
  );
  const [slot, setSlot] = useState<Element | null>(null);

  useEffect(() => {
    if (!short) return;
    const town = document.querySelector(".d2-page .fs-town");
    if (!town) return;
    town.classList.add("d2-has-short");
    const frame = requestAnimationFrame(() => setSlot(town));
    return () => {
      cancelAnimationFrame(frame);
      town.classList.remove("d2-has-short");
      setSlot(null);
    };
  }, [short]);

  if (!short || !slot) return null;
  const lifted = (id: string) =>
    acts.filter((act) => act.anchorVenue.entityId === id).length;
  // The town's standing order: most acts lifted in front, then the order the agent read them.
  const standing: SceneVenue[] = venues
    .map((venue, index) => ({ venue, index, lifted: lifted(venue.entityId) }))
    .sort((a, b) => b.lifted - a.lifted || a.index - b.index)
    .map(({ venue, lifted: count }) => ({
      entityId: venue.entityId,
      name: venue.name,
      hue: count > 0 ? (hues[venue.entityId] ?? null) : null,
      lifted: count,
      off: false,
      unread: false,
      noFanData: noFanData.includes(venue.entityId),
    }));
  return createPortal(
    <div className="d2-short-town">
      <TownScene
        seedKey={seedKey}
        venues={standing}
        selected={null}
        focusOn={null}
      />
    </div>,
    slot,
  );
}
