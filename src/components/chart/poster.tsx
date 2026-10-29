"use client";

import { useState, type ReactNode } from "react";
import type { ArtistImages } from "@/lib/artist-images";
import type { FeeBand } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { Act } from "@/lib/lineup";
import type { LlmOnlyPick, PickCheck } from "@/lib/llm-only";
import { markLabel } from "@/lib/marks";
import type { ChartRowData, Printing } from "./band-chart";
import { PRINT_STEP_S } from "./band-chart";
import { Cover } from "./cover";
import {
  bandRange,
  climbMark,
  inkLabel,
  modelPicksTitle,
  pickTag,
  rulerTitle,
  type WithoutCounts,
} from "./poster-words";
import { ordinal, PLAIN_BAND, pickCheckLine } from "./words";
import { signName } from "./town-scene";
import { Quilt } from "./sleeve";

/** The booked headliners at the top of the poster, each with Qloo's photo or a drawn quilt. */
export function HeadlinerList({
  headliners,
  images,
  ids,
}: {
  headliners: readonly string[];
  images?: ArtistImages;
  /** Each headliner's Qloo id, by name, from the saved build. */
  ids?: ReadonlyMap<string, string>;
}) {
  return (
    <ul aria-label="Booked headliners" className="poster-heads">
      {headliners.map((name) => {
        const id = ids?.get(name);
        const image = id ? images?.[id] : undefined;
        return (
          <li key={name} className="poster-head">
            <span className="poster-head-photo" aria-hidden>
              {image ? (
                <Cover
                  image={image}
                  genres={null}
                  id={id ?? name}
                  name={name}
                  label={false}
                  className="poster-head-cover"
                />
              ) : (
                <Quilt name={name} className="poster-head-cover" />
              )}
            </span>
            <span className="poster-head-name">{name}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** A venue the build read, as the poster's key shows it. */
export interface KeyVenue {
  entityId: string;
  name: string;
  /** Its colour; null while its fans lift no act (grey). */
  hue: number | null;
  lifted: number;
  off: boolean;
  /** Qloo had no fan data for it (WS8): its count says so, in grey, as its sign in the town. */
  noFanData?: boolean;
}

/**
 * The poster's key: "Drafted by Undercard from the fans of" each venue the build read, each a
 * switch for its fans when the venue switch is ready (the same switch as Switch a venue off).
 */
export function VenueKey({
  venues,
  switchable,
  onToggle,
  onHover,
  quiet = false,
}: {
  venues: readonly KeyVenue[];
  /** The switch is ready and nothing else runs. */
  switchable: boolean;
  onToggle?: (venueId: string) => void;
  onHover?: (venueId: string | null) => void;
  /** Dimmed while Watch reads the venues. */
  quiet?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Venue fans used for this draft"
      className={`poster-key ${quiet ? "is-quiet" : ""}`}
    >
      <p className="poster-chip">Drafted by Undercard</p>
      <span className="poster-key-from">from the fans of</span>
      <span className="poster-key-break" aria-hidden />
      {venues.map((venue) => {
        const lit = !venue.off && venue.lifted > 0 && venue.hue !== null;
        const body = (
          <>
            <span
              className={`poster-ink-swatch ${lit ? `venue-${venue.hue}` : ""} ${venue.off ? "is-off" : ""}`}
              aria-hidden
            >
              {venue.off ? (
                <svg viewBox="0 0 16 16">
                  <path d="M4 4 L12 12 M12 4 L4 12" className="poster-ink-x" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16">
                  <path
                    d="M3 8.5 L6.5 12 L13 4.5"
                    className="poster-ink-tick"
                  />
                </svg>
              )}
            </span>
            <span className="poster-ink-name">{signName(venue.name)}</span>
            {/* WS12 item 7: grey where the venue is unlit, as its sign in the town. */}
            <span className={`poster-ink-count ${lit ? "" : "is-grey"}`}>
              {venue.off
                ? "off"
                : venue.noFanData
                  ? "no fan data"
                  : venue.lifted}
            </span>
          </>
        );
        return switchable && onToggle ? (
          <button
            key={venue.entityId}
            type="button"
            className={`poster-ink ${venue.off ? "is-off" : ""}`}
            aria-pressed={!venue.off}
            aria-label={inkLabel(
              venue.name,
              !venue.off,
              venue.lifted,
              venue.noFanData,
            )}
            onClick={() => onToggle(venue.entityId)}
            onMouseEnter={() => onHover?.(venue.entityId)}
            onMouseLeave={() => onHover?.(null)}
          >
            {body}
          </button>
        ) : (
          <span
            key={venue.entityId}
            className={`poster-ink ${venue.off ? "is-off" : ""}`}
            role="img"
            aria-label={`${venue.name}'s fans: ${venue.off ? "off" : venue.noFanData ? "no fan data on Qloo" : venue.lifted === 1 ? "1 act" : `${venue.lifted} acts`}`}
          >
            {body}
          </span>
        );
      })}
    </div>
  );
}

function PosterAct({
  row,
  top,
  open,
  kept,
  gone,
  fresh = false,
  dim,
  onOpen,
  onPoint,
  printDelay,
}: {
  row: ChartRowData & { act: Act };
  top?: number;
  open: boolean;
  kept: boolean;
  gone: boolean;
  /** The last refill's replacement, marked until the buyer's next action (WS18 item 3). */
  fresh?: boolean;
  dim: boolean;
  onOpen?: (act: Act) => void;
  /** The act was pointed at or focused: the door check shows its ticket (WS12 item 1). */
  onPoint?: (act: Act) => void;
  printDelay: number | null;
}) {
  // Decided when the act mounts, so the acts already on the poster never print again.
  const [print] = useState(printDelay);
  // The act's place in its venue's ranking over its climb (WS8): "5th ↑14".
  const climb = climbMark(row.act);
  const mark = climb && (
    <>
      {row.place !== null && (
        <span className="poster-rank">{ordinal(row.place)} </span>
      )}
      {climb}
    </>
  );
  return (
    <article
      aria-label={row.name}
      data-act={row.act.entityId}
      onPointerEnter={onPoint ? () => onPoint(row.act) : undefined}
      onFocus={onPoint ? () => onPoint(row.act) : undefined}
      className={`poster-act ${row.hue !== null ? `venue-${row.hue}` : ""} ${open ? "is-open" : ""} ${gone ? "is-gone" : ""} ${kept ? "is-kept" : ""} ${fresh ? "is-replacement" : ""} ${dim ? "is-dim" : ""} ${print !== null ? "motion-safe:animate-print-in" : ""}`}
      style={
        print !== null ? { animationDelay: `${print.toFixed(2)}s` } : undefined
      }
    >
      {onOpen ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? "act-card" : undefined}
          onClick={() => onOpen(row.act)}
        >
          {row.name}
          {mark && (
            <span className="poster-climb" aria-hidden>
              {mark}
            </span>
          )}
        </button>
      ) : (
        <span className="poster-act-name">
          {row.name}
          {mark && (
            <span className="poster-climb" aria-hidden>
              {mark}
            </span>
          )}
        </span>
      )}
      {kept && !gone && <span className="poster-flag">Kept</span>}
      {gone && <span className="poster-flag">Unavailable</span>}
      {fresh && !kept && !gone && (
        <span className="poster-flag">Replacement</span>
      )}
      <p className="sr-only">
        {row.words ??
          markLabel(
            row.act,
            top,
            row.place !== null ? ordinal(row.place) : undefined,
          )}
      </p>
    </article>
  );
}

/**
 * One band of the poster: its name and Qloo popularity range, then its acts as the poster prints
 * them, each in its venue's colour with its climb, and its open slots. While Watch plays, an act
 * holds an open slot until its venue's fans are read.
 */
export function PosterBand({
  band,
  first,
  rows,
  top,
  openId = null,
  keeping = [],
  unavailable = [],
  replacement = null,
  onOpen,
  onPoint,
  printing = null,
  column = 0,
  landed,
  stampAt,
  dimmed,
  caption,
  message,
  children,
}: {
  band: FeeBand;
  /** The first band on the poster says what the range stands for. */
  first: boolean;
  rows: ChartRowData[];
  top?: number;
  openId?: string | null;
  keeping?: readonly string[];
  unavailable?: readonly string[];
  /** The last refill's replacement, marked until the buyer's next action (WS18 item 3). */
  replacement?: string | null;
  onOpen?: (act: Act) => void;
  /** An act pointed at or focused on the poster (WS12 item 1's door check). */
  onPoint?: (act: Act) => void;
  printing?: Printing;
  /** The band's place, 0 or 1, so a replay's two bands print side by side. */
  column?: number;
  /** While Watch plays: whether an act's venue has been read yet. */
  landed?: (act: Act) => boolean;
  /** While Watch flies an act in: seconds until its card lands and its slot stamps in. */
  stampAt?: (act: Act) => number | undefined;
  /** Acts faded while another venue is picked. */
  dimmed?: (act: Act) => boolean;
  /** A line under the head: what this band waits for while Watch plays. */
  caption?: ReactNode;
  /** Every slot open with venues switched off: why, and the way back. */
  message?: {
    head: string;
    text: string;
    fix?: { label: string; onClick: () => void };
  };
  /** The open act's card, shown under the band. */
  children?: (act: Act) => ReactNode;
}) {
  const headingId = `chart-${band.id}`;
  const openAct = rows.find(
    (row) => row.act && row.act.entityId === openId,
  )?.act;
  let printed = 0;
  return (
    <section
      aria-labelledby={headingId}
      className={`poster-band poster-band-${band.id}`}
    >
      <div className="poster-band-head">
        <h2 id={headingId} className="poster-band-name">
          {PLAIN_BAND[band.id]}
        </h2>
        <span className="poster-band-range">· {bandRange(band, first)}</span>
      </div>
      {caption && (
        <p className="poster-band-caption" aria-live="polite">
          {caption}
        </p>
      )}
      {message ? (
        <div role="status" className="poster-open">
          <p>
            <strong>{message.head}</strong> {message.text}
          </p>
          {message.fix && (
            <button
              type="button"
              className="poster-fix"
              onClick={message.fix.onClick}
            >
              {message.fix.label}
            </button>
          )}
        </div>
      ) : (
        <ul className="poster-acts">
          {rows.map((row) => {
            const act = row.act;
            const shown =
              row.kind === "act" && act !== null && (!landed || landed(act));
            if (!shown || !act)
              return (
                <li key={row.key} className="poster-slot-li">
                  <span className="poster-slot">
                    Open slot
                    {row.words && <span className="sr-only">{row.words}</span>}
                  </span>
                </li>
              );
            const index = printed++;
            return (
              <li key={row.key}>
                <PosterAct
                  row={row as ChartRowData & { act: Act }}
                  top={top}
                  open={openId === act.entityId}
                  kept={keeping.includes(act.entityId)}
                  gone={unavailable.includes(act.entityId)}
                  fresh={replacement === act.entityId}
                  dim={dimmed?.(act) ?? false}
                  onOpen={onOpen}
                  onPoint={onPoint}
                  printDelay={
                    printing === null
                      ? null
                      : // A refill's act, and an act landing while Watch reads its venue, stamp
                        // in at once; the rest of a replay's lineup prints in down the poster.
                        printing === "refill"
                        ? 0
                        : landed
                          ? (stampAt?.(act) ?? 0)
                          : (index * 2 + column) * PRINT_STEP_S
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      {openAct && children?.(openAct)}
    </section>
  );
}

/** Qloo's popularity scale under the Without Qloo headline: each pick a dot over the ranges. */
export function PicksRuler({
  festival,
  checks,
  counts,
}: {
  festival: Pick<Festival, "feeBands">;
  checks: readonly PickCheck[];
  counts: WithoutCounts;
}) {
  const bands = [...festival.feeBands].sort(
    (a, b) => a.minPopularity - b.minPopularity,
  );
  const low = Math.min(...bands.map((band) => band.minPopularity));
  const high = Math.max(...bands.map((band) => band.maxPopularity));
  const span = 1 - low;
  const at = (popularity: number) =>
    Math.max(1.5, Math.min(98.5, ((popularity - low) / span) * 100));
  // Dots stack in rows where they'd touch, nearest row first.
  const found = checks
    .flatMap((check) =>
      check.status === "found"
        ? [
            {
              name: check.name,
              x: at(check.popularity),
              above: check.range === "above",
            },
          ]
        : [],
    )
    .sort((a, b) => a.x - b.x);
  const rows: number[][] = [];
  const dots = found.map((dot) => {
    let row = rows.findIndex(
      (xs) => Math.abs(dot.x - xs[xs.length - 1]) >= 2.7,
    );
    if (row < 0) {
      rows.push([]);
      row = rows.length - 1;
    }
    rows[row].push(dot.x);
    return { ...dot, row };
  });
  const width = (from: number, to: number) => ((to - from) / span) * 100;
  const label = `Qloo popularity scale from ${Math.round(low * 100)} to 100: ${bands
    .map(
      (band) =>
        `${PLAIN_BAND[band.id].toLowerCase()} ${Math.round(band.minPopularity * 100)} to ${Math.round(band.maxPopularity * 100)}`,
    )
    .join(
      ", ",
    )}, too big above ${Math.round(high * 100)}. Of the model's ${counts.picks} picks, ${counts.above} sit above every range, ${counts.found - counts.above - counts.below} inside one, ${counts.below} below, and ${counts.notFound + counts.notChecked} aren't placed.`;
  return (
    <div role="img" aria-label={label} className="ruler">
      <p className="ruler-title" aria-hidden>
        {rulerTitle(counts)}
      </p>
      <div
        className="ruler-scale"
        style={{ paddingTop: 6 + rows.length * 11 }}
        aria-hidden
      >
        {dots.map((dot) => (
          <span
            key={dot.name}
            className={`ruler-dot ${dot.above ? "is-above" : ""}`}
            style={{
              left: `${dot.x.toFixed(2)}%`,
              top: (rows.length - 1 - dot.row) * 11,
            }}
          />
        ))}
        <div className="ruler-bar">
          {bands.map((band) => (
            <span
              key={band.id}
              className={`ruler-band ruler-band-${band.id}`}
              style={{
                flexGrow: width(band.minPopularity, band.maxPopularity),
              }}
            >
              {band.id === "mid" ? "Mid-size" : "Opening acts"}
            </span>
          ))}
          <span
            className="ruler-band ruler-band-over"
            style={{ flexGrow: width(high, 1) }}
          >
            Too big
          </span>
        </div>
      </div>
      <div className="ruler-ticks" aria-hidden>
        {[low, ...bands.map((band) => band.maxPopularity)]
          .filter((value, index, all) => all.indexOf(value) === index)
          .map((value) => (
            <span
              key={value}
              style={{ left: `${(((value - low) / span) * 100).toFixed(2)}%` }}
            >
              {Math.round(value * 100)}
            </span>
          ))}
        <span style={{ left: "100%" }}>100</span>
      </div>
    </div>
  );
}

/**
 * Without Qloo's picks: one list, never sorted into slots (the model's picks have none), each
 * with its tag from prompt 4's checks. A pick opens its card: the model's own reason, and how
 * Qloo's data places it.
 */
export function ModelPicks({
  festival,
  picks,
  checks,
}: {
  festival: Festival;
  picks: readonly LlmOnlyPick[];
  checks: readonly PickCheck[] | undefined;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const byName = new Map(checks?.map((check) => [check.name, check]));
  const tone = (check: PickCheck | undefined) =>
    !check || check.status !== "found"
      ? "is-missing"
      : check.range === "in"
        ? "is-in"
        : "is-out";
  const openPick = picks.find((pick) => pick.name === open);
  // The model's own reason under each pick's name, when its answer gave one for every pick (WS8).
  const reasons = picks.every((pick) => pick.note?.trim());
  return (
    <>
      <div className="picks-head">
        <h2 className="poster-band-name">{modelPicksTitle(picks.length)}</h2>
        <span className="poster-band-range">· checked on Qloo afterwards</span>
      </div>
      <ul className="model-picks">
        {picks.map((pick, index) => {
          const check = byName.get(pick.name);
          return (
            <li key={pick.name}>
              <article aria-label={pick.name} className="model-pick">
                <button
                  type="button"
                  aria-expanded={open === pick.name}
                  aria-controls={open === pick.name ? "pick-card" : undefined}
                  onClick={() =>
                    setOpen((current) =>
                      current === pick.name ? null : pick.name,
                    )
                  }
                >
                  {pick.name}
                </button>
                {reasons && <p className="model-pick-reason">{pick.note}</p>}
                <span
                  className={`model-pick-tag ${tone(check)} ${index % 2 ? "tilt-right" : "tilt-left"}`}
                >
                  {pickTag(check, festival)}
                </span>
                <p className="sr-only pick-none">
                  {pickCheckLine(check, festival)}
                </p>
              </article>
            </li>
          );
        })}
      </ul>
      {openPick && (
        <section
          id="pick-card"
          aria-label="The model's pick"
          className="pick-card"
        >
          <p className="pick-card-name">{openPick.name}</p>
          <p className="pick-card-why">
            <strong>The model&apos;s reason: </strong>
            {openPick.note}
          </p>
          <p className="pick-card-line">
            {pickCheckLine(byName.get(openPick.name), festival)}
          </p>
          <button
            type="button"
            className="poster-fix"
            onClick={() => setOpen(null)}
          >
            Close
          </button>
        </section>
      )}
    </>
  );
}

/** The poster's last row: the lineup out as a CSV, and a draft for the visitor's own festival. */
export function PosterActions({ children }: { children: ReactNode }) {
  return <div className="poster-actions">{children}</div>;
}
