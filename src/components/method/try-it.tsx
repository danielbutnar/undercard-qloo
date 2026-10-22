"use client";

import { useMemo } from "react";
import { BandChart } from "@/components/chart/band-chart";
import { billRows } from "@/components/chart/chart-rows";
import { useVenueSwitch } from "@/components/use-venue-switch";
import { useReducedMotion } from "@/components/use-watch";
import { pictured } from "@/lib/artist-images";
import type { Act } from "@/lib/lineup";
import type { MethodStory } from "@/lib/method-story";
import { venueHues } from "@/lib/venue-colours";

const names = (acts: readonly Act[]) => {
  const list = acts.map((act) => act.name);
  return list.length < 2
    ? (list[0] ?? "")
    : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
};

/**
 * One venue switch (M10b): the followed act's venue off, and the band's lineup re-forms by the
 * same rule from the venues left on, worked out from the saved build's own Qloo results
 * (GET /api/venue-switch), with no new Qloo call.
 */
export function TryIt({
  story,
  festivalId,
}: {
  story: MethodStory;
  festivalId: string;
}) {
  const reduced = useReducedMotion();
  const switcher = useVenueSwitch(festivalId, story.buildId, true);
  const { act, band } = story;
  const venue = act.anchorVenue;
  const off = switcher.off.has(venue.entityId);
  const hues = useMemo(
    () => venueHues(story.venues, story.acts),
    [story.venues, story.acts],
  );
  const acts = off ? (switcher.lineup?.acts ?? []) : story.acts;
  const places = off ? (switcher.lineup?.places ?? {}) : story.places;
  const open = off
    ? (switcher.lineup?.shortfall[band.id] ?? 0)
    : Math.max(
        0,
        band.slots -
          story.acts.filter((entry) => entry.band === band.id).length,
      );
  const inBand = (list: readonly Act[]) =>
    list.filter((entry) => entry.band === band.id);
  const left = inBand(story.acts).filter(
    (entry) => !acts.some((kept) => kept.entityId === entry.entityId),
  );
  const joined = inBand(acts).filter(
    (entry) => !story.acts.some((saved) => saved.entityId === entry.entityId),
  );
  const hue = hues.get(venue.entityId) ?? 0;

  return (
    <section aria-label="Try it" className="how-section how-try">
      <h2 className="band-name">Try it</h2>
      <p className="how-sub">
        Switch {venue.name}&apos;s fans off: the{" "}
        {band.label === "Mid" ? "mid-size" : "opening"} lineup re-forms by the
        same rule from the venues left on, with no new Qloo call.
      </p>
      {switcher.status === "ready" ? (
        <button
          type="button"
          role="switch"
          aria-checked={!off}
          aria-label={`${venue.name}'s fans`}
          onClick={() => switcher.toggle(venue.entityId)}
          className={`how-switch venue-${hue} ${off ? "is-off" : ""}`}
        >
          <i className="how-swatch" aria-hidden />
          <span className="how-switch-name" aria-hidden>
            {venue.name}&apos;s fans
          </span>
          <span className="how-switch-state" aria-hidden>
            {off ? "Off" : "On"}
          </span>
        </button>
      ) : (
        <p className="how-sub">
          {switcher.status === "loading"
            ? "Reading the saved build's venue results…"
            : "The switch isn't available for this build."}
        </p>
      )}
      <p className="how-try-says" aria-live="polite">
        {off
          ? `Without ${venue.name}'s fans, ${left.length ? `${names(left)} leave the lineup` : "no act leaves the lineup"}${joined.length ? `; ${names(joined)} ${joined.length === 1 ? "joins" : "join"}` : ""}${open ? `; ${open} ${open === 1 ? "slot stays" : "slots stay"} open` : ""}.`
          : "Every venue on: the lineup as Undercard drafted it."}
      </p>
      <BandChart
        band={band}
        rows={pictured(
          billRows(
            band,
            acts,
            places,
            hues,
            open,
            "No act from the venues left on clears the bar.",
            "climb",
          ),
          story.images,
        )}
        sortKey={off ? "off" : "on"}
        motion={!reduced}
        numbers="climb"
      />
    </section>
  );
}
