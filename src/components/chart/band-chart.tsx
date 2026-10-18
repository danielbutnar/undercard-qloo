"use client";

import { useState, type ReactNode } from "react";
import type { FeeBand } from "@/lib/fee-bands";
import { formatBandRange } from "@/lib/format";
import type { Act } from "@/lib/lineup";
import { markLabel } from "@/lib/marks";
import { Sleeve } from "./sleeve";
import { useFlip } from "./use-flip";
import { feeRangeWords, ordinal, PLAIN_BAND } from "./words";

/** Places on a band's chart the arrows are drawn against: Qloo's top 50. */
const TOP = 50;

/** One line of a band's chart: an act on the lineup, an act an edition lists, or an open slot. */
export interface ChartRowData {
  key: string;
  kind: "act" | "listed" | "open";
  name: string;
  /** Its place in Qloo's ranking now. */
  place: number | null;
  /** Its place for the headliners' fans alone; null for a new entry or when unknown. */
  was: number | null;
  /** Places it climbed with a venue's fans, past the bar; null when it didn't. */
  move: number | null;
  /** New to the top 50 with a venue's fans. */
  fresh: boolean;
  genres: readonly string[] | null;
  /** The venue colour it carries, or null for a plain row. */
  hue: number | null;
  venueShort: string | null;
  act: Act | null;
  /** An edition row whose act this venue's fans put on the lineup. */
  booked?: boolean;
  /** Read out instead of the act's mark (edition rows and refills). */
  words?: string;
}

/**
 * The climb as a picture: an arrow from the act's old place into its place now, as long as the
 * move (50 places fill the cell); a new entry's arrow comes dashed from outside the top 50.
 */
export function ClimbArrow({
  move,
  fresh,
  was,
}: {
  move: number | null;
  fresh: boolean;
  was: number | null;
}) {
  if (!fresh && move === null) return <span className="climb climb-still" />;
  const share = fresh ? 1 : Math.min(1, Math.max(0.18, (move ?? 0) / TOP));
  return (
    <span className="climb" aria-hidden>
      <span className="climb-track">
        <span
          className={`climb-arrow ${fresh ? "climb-new" : ""}`}
          style={{ ["--share" as string]: share }}
        >
          <span className="climb-shaft" />
          <span className="climb-head">{fresh ? "new" : `+${move}`}</span>
        </span>
      </span>
      <span className="climb-was">
        {fresh ? "not in top 50" : was !== null ? `was ${ordinal(was)}` : ""}
      </span>
    </span>
  );
}

function Row({
  row,
  top,
  open,
  kept,
  gone,
  onOpen,
  printDelay,
}: {
  row: ChartRowData;
  top?: number;
  open: boolean;
  kept: boolean;
  gone: boolean;
  onOpen?: (act: Act) => void;
  /** Seconds before the row prints in, when a replay reprints the lineup. */
  printDelay: number | null;
}) {
  if (row.kind === "open")
    return (
      <div className="row row-open">
        <span className="row-place" aria-hidden>
          –
        </span>
        <p className="row-open-words">
          <span className="row-open-title">Open slot</span>
          <span>No act from the venues left on clears the bar.</span>
        </p>
      </div>
    );
  const hue = row.hue === null ? "" : `venue-${row.hue}`;
  const body = (
    <>
      <span className="row-place" aria-hidden>
        <span className="row-place-n">{row.place ?? "·"}</span>
      </span>
      <ClimbArrow move={row.move} fresh={row.fresh} was={row.was} />
      {row.genres ? (
        <Sleeve
          genres={row.genres}
          id={row.key}
          label={false}
          className="row-sleeve"
        />
      ) : (
        <span className="sleeve row-sleeve sleeve-blank" aria-hidden />
      )}
      <div className="row-who">
        <h3 className="row-name">
          {row.act && onOpen ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={open ? "act-card" : undefined}
              onClick={() => onOpen(row.act!)}
            >
              {row.name}
            </button>
          ) : (
            row.name
          )}
        </h3>
        {row.genres && <p className="row-genres">{row.genres.join(" · ")}</p>}
        {kept && !gone && <p className="row-flag row-kept">Kept</p>}
        {gone && <p className="row-flag row-gone">Unavailable</p>}
        {row.booked && <p className="row-flag row-booked">On the lineup</p>}
      </div>
      {row.venueShort ? (
        <span className="row-venue" aria-hidden>
          <span>{row.venueShort}</span>
        </span>
      ) : (
        <span className="row-venue row-venue-none" aria-hidden />
      )}
      <p className="sr-only">
        {row.words ?? (row.act ? markLabel(row.act, top) : "")}
      </p>
    </>
  );
  if (row.kind === "listed")
    return (
      <div className={`row row-listed ${hue} ${row.booked ? "is-booked" : ""}`}>
        {body}
      </div>
    );
  return (
    <article
      aria-label={row.name}
      className={`row ${hue} ${open ? "is-open" : ""} ${gone ? "is-gone" : ""} ${kept ? "is-kept" : ""} ${printDelay !== null ? "motion-safe:animate-print-in" : ""}`}
      style={
        printDelay !== null
          ? { animationDelay: `${printDelay.toFixed(2)}s` }
          : undefined
      }
    >
      {body}
    </article>
  );
}

/** The slot pips by a band's name: one square per slot, filled when an act holds it. */
function Slots({ filled, slots }: { filled: number; slots: number }) {
  return (
    <span
      className="slots"
      role="img"
      aria-label={`${filled} of ${slots} slots filled`}
    >
      {Array.from({ length: slots }, (_, i) => (
        <i key={i} className={i < filled ? "on" : ""} />
      ))}
      <span className="slots-words" aria-hidden>
        {slots} slots
      </span>
    </span>
  );
}

/** The fee range as a picture: Qloo's popularity scale with the band's range lit. */
function FeeRange({ band }: { band: FeeBand }) {
  const [open, setOpen] = useState(false);
  const left = band.minPopularity * 100;
  const width = (band.maxPopularity - band.minPopularity) * 100;
  return (
    <div className="fee">
      <span className="fee-label">Fee range, by popularity</span>
      <span className="fee-track" aria-hidden>
        <span
          className="fee-lit"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </span>
      <span className="fee-range">{formatBandRange(band)}</span>
      <button
        type="button"
        className="fee-why"
        aria-expanded={open}
        aria-label={`What the fee range for ${PLAIN_BAND[band.id].toLowerCase()} means`}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {open && <p className="fee-words">{feeRangeWords(band)}</p>}
    </div>
  );
}

/**
 * One fee range's chart: its name, slot pips and fee range, then its rows. Rows glide to their
 * new places when the chart re-sorts: an edition during Watch, or the venue switch.
 */
export function BandChart({
  band,
  rows,
  sortKey,
  motion,
  top,
  openId = null,
  keeping = [],
  unavailable = [],
  onOpen,
  printing = null,
  caption,
  children,
}: {
  band: FeeBand;
  rows: ChartRowData[];
  /** Changes once per re-sort, so the rows' glide plays once. */
  sortKey: unknown;
  motion: boolean;
  top?: number;
  openId?: string | null;
  keeping?: readonly string[];
  unavailable?: readonly string[];
  onOpen?: (act: Act) => void;
  /** Delays per act id, when a replay reprints the lineup act by act. */
  printing?: ReadonlyMap<string, number> | null;
  /** A line under the header: what this edition of the chart is. */
  caption?: ReactNode;
  /** The open act's card, shown under its row. */
  children?: (act: Act) => ReactNode;
}) {
  const flip = useFlip<HTMLLIElement>(sortKey, motion);
  const filled = rows.filter(
    (row) =>
      row.kind === "act" && !unavailable.includes(row.act?.entityId ?? ""),
  ).length;
  const headingId = `chart-${band.id}`;
  const listing = rows.some((row) => row.kind === "listed");
  return (
    <section aria-labelledby={headingId} className="band">
      <div className="band-head">
        <h2 id={headingId} className="band-name">
          {PLAIN_BAND[band.id]}
        </h2>
        {!listing && <Slots filled={filled} slots={band.slots} />}
        <FeeRange band={band} />
      </div>
      {caption && (
        <p className="band-caption" aria-live="polite">
          {caption}
        </p>
      )}
      <ol className={`rows ${listing ? "rows-listing" : ""}`}>
        {rows.map((row) => (
          <li key={row.key} ref={flip(row.key)}>
            <Row
              row={row}
              top={top}
              open={openId !== null && row.act?.entityId === openId}
              kept={keeping.includes(row.act?.entityId ?? "")}
              gone={unavailable.includes(row.act?.entityId ?? "")}
              onOpen={onOpen}
              printDelay={
                row.act ? (printing?.get(row.act.entityId) ?? null) : null
              }
            />
            {row.act && openId === row.act.entityId && children?.(row.act)}
          </li>
        ))}
      </ol>
    </section>
  );
}
