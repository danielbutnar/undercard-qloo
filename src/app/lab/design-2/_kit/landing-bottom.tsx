"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ordinal } from "@/components/chart/words";
import type { ArtistImages } from "@/lib/artist-images";
import type { Festival } from "@/lib/festival";
import type { Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import type { Placed } from "@/lib/venue-switch";
import type { LabStory } from "./data";
import { Setlist } from "./setlist";
import { Ticket } from "./ticket";
import { useReveal } from "./use-reveal";

/** The act's move, as the setlist writes it in the margin by its circled call. */
export function marginNote(act: Act, place: Placed | undefined): string {
  const lift = liftOf(act);
  if (lift?.kind === "new")
    return `${act.name}: new in the top 50, at ${ordinal(place?.now ?? lift.top)}`;
  return place?.was
    ? `${act.name}: ${ordinal(place.was)} → ${ordinal(place.now)}`
    : act.name;
}

/**
 * The landing page's lower half in Design 2.0 (WS12 item 1): the AI agent's setlist under the
 * town, the door check under the poster, on the first screen's two column edges, then the page's
 * last line. Pointing at an act on the poster (or tabbing to it) makes the ticket that act's, and
 * the setlist circles the call that lifted it.
 */
export function LandingBottom({
  festival,
  acts,
  places,
  images,
  story,
}: {
  festival: Festival;
  acts: readonly Act[];
  places: Readonly<Record<string, Placed>>;
  images?: ArtistImages;
  story: LabStory;
}) {
  const [actId, setActId] = useState(story.firstId);
  const act = acts.find((entry) => entry.entityId === actId) ?? null;
  const ids = useMemo(() => acts.map((entry) => entry.entityId), [acts]);

  // The poster is FestivalScreen's own: its act strips carry data-act.
  useEffect(() => {
    const pick = (event: Event) => {
      const strip = (event.target as Element | null)?.closest?.(
        ".fs-poster [data-act]",
      );
      const id = strip?.getAttribute("data-act");
      if (id && ids.includes(id)) setActId(id);
    };
    document.addEventListener("pointerover", pick);
    document.addEventListener("focusin", pick);
    return () => {
      document.removeEventListener("pointerover", pick);
      document.removeEventListener("focusin", pick);
    };
  }, [ids]);

  const circled = act
    ? (story.lines.find(
        (line) =>
          line.band === act.band &&
          line.venue?.entityId === act.anchorVenue.entityId,
      )?.n ?? null)
    : null;
  const band = act
    ? festival.feeBands.find((entry) => entry.id === act.band)
    : undefined;
  const door = useReveal<HTMLElement>();
  const end = useReveal<HTMLElement>();

  return (
    <div className="d2-bottom">
      <div className="d2-cols">
        <div className="d2-col-town">
          <Setlist
            festival={festival}
            createdAt={story.createdAt}
            lines={story.lines}
            closing={story.closing}
            hues={story.hues}
            circled={circled}
            margin={act ? marginNote(act, places[act.entityId]) : null}
            trace={story.trace}
          />
        </div>
        <div className="d2-col-poster">
          {act && band && (
            <section
              ref={door}
              aria-labelledby="d2-door-title"
              className="d2-door"
            >
              <h2 id="d2-door-title" className="d2-h2">
                The door check
              </h2>
              <p className="d2-lede">
                Every act on your poster got past these three checks.
                <span className="d2-wide-only">
                  {" "}
                  Point at an act on the poster for its ticket.
                </span>
              </p>
              <Ticket
                act={act}
                band={band}
                place={places[act.entityId]}
                hue={story.hues[act.anchorVenue.entityId] ?? null}
                image={images?.[act.entityId]}
                festival={festival}
              />
              <p className="d2-door-rule">
                Of the acts that pass all three, the strongest Qloo match fills
                each slot first.
              </p>
            </section>
          )}
        </div>
      </div>
      <section ref={end} aria-label="Who decides" className="d2-end">
        <p className="d2-end-line">
          Undercard drafts.
          <br />
          The buyer makes every call.
        </p>
        <Link href="/your-festival" className="d2-end-cta">
          Draft your own festival
          <svg viewBox="0 0 16 16" aria-hidden>
            <path d="M2 8 H13 M9 4 L13 8 L9 12" />
          </svg>
        </Link>
      </section>
    </div>
  );
}
