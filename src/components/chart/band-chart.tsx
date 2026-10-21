"use client";

import { useState, type ReactNode } from "react";
import type { FeeBand } from "@/lib/fee-bands";
import { formatBandRange } from "@/lib/format";
import type { Act } from "@/lib/lineup";
import { markLabel } from "@/lib/marks";
import { Sleeve } from "./sleeve";
import { useFlip } from "./use-flip";
import { feeRangeWords, ordinal, PLAIN_BAND } from "./words";

/**
 * What prints rows that mount now: a replay's lineup prints down the chart row by row, both bands
 * side by side; a refill's replacement prints straight into its slot; null prints nothing.
 */
export type Printing = "replay" | "refill" | null;

/** A replay's rows print 0.12 s apart, the two bands' rows alternating. */
export const PRINT_STEP_S = 0.12;

/** Places on a band's chart the arrows are drawn against: Qloo's top 50. */
export const TOP = 50;

/**
 * What the big number on a row says (M10a, docs/evidence.md section 27). On the lineup it is the
 * climb: the places an act rose when its venue's fans were added, since the acts' places come
 * from different venues' lists. In one of Watch's editions, a single list, it is the place.
 */
export type RowNumbers = "place" | "climb";

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
        {fresh
          ? "not in top 50"
          : was !== null
            ? `was ${ordinal(was)}`
            : `up ${move} places`}
      </span>
    </span>
  );
}

/** The climb's mark, drawn rather than typed: the display face has no ▲. */
export function Tri({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 9" className={`tri ${className}`} aria-hidden>
      <path d="M5 .8 9.3 8.3H.7z" />
    </svg>
  );
}

/** A climb's two places: for the headliners' fans alone, then with the venue's fans added. */
function climbEnds(row: ChartRowData) {
  const from = row.fresh
    ? "outside the top 50"
    : row.was !== null
      ? ordinal(row.was)
      : null;
  const to = row.place !== null ? ordinal(row.place) : null;
  return from !== null && to !== null ? { from, to } : null;
}

/** The small ladder under an act's name, from its old place up to its place now. */
function Ladder({ row }: { row: ChartRowData }) {
  if (!row.fresh && row.move === null) return <span className="ladder" />;
  const ends = climbEnds(row);
  if (!ends)
    return (
      <span className="ladder" aria-hidden>
        up {row.move} places
      </span>
    );
  const share = row.fresh
    ? 1
    : Math.min(1, Math.max(0.18, (row.move ?? 0) / TOP));
  return (
    <span className={`ladder ${row.fresh ? "ladder-new" : ""}`} aria-hidden>
      <span>{ends.from}</span>
      <span className="ladder-arrow" style={{ ["--share" as string]: share }}>
        <span className="ladder-shaft" />
        <svg viewBox="0 0 6 10" className="ladder-head">
          <path d="M0 0 6 5 0 10z" />
        </svg>
      </span>
      <span className="ladder-to">{ends.to}</span>
    </span>
  );
}

/** The row's big number: the climb, or in an edition the place. */
function BigNumber({
  row,
  numbers,
}: {
  row: ChartRowData;
  numbers: RowNumbers;
}) {
  if (numbers === "climb")
    return (
      <span className="row-place row-hero" aria-hidden>
        {row.fresh ? (
          <span className="hero-new">NEW</span>
        ) : row.move !== null ? (
          <>
            <Tri className="hero-tri" />
            {row.move}
          </>
        ) : (
          "·"
        )}
      </span>
    );
  return (
    <span className="row-place" aria-hidden>
      <span className="row-place-n">{row.place ?? "·"}</span>
    </span>
  );
}

function Row({
  row,
  numbers,
  top,
  open,
  kept,
  gone,
  onOpen,
  printDelay,
}: {
  row: ChartRowData;
  numbers: RowNumbers;
  top?: number;
  open: boolean;
  kept: boolean;
  gone: boolean;
  onOpen?: (act: Act) => void;
  /** Seconds before the row prints in, when a replay reprints the lineup. */
  printDelay: number | null;
}) {
  // Decided when the row mounts, so the rows already on the chart never print again.
  const [print] = useState(printDelay);
  if (row.kind === "open")
    return (
      <div className="row row-open">
        <span className="row-place" aria-hidden>
          –
        </span>
        <p className="row-open-words">
          <span className="row-open-title">Open slot</span>
          <span>{row.words}</span>
        </p>
      </div>
    );
  const hue = row.hue === null ? "" : `venue-${row.hue}`;
  const body = (
    <>
      <BigNumber row={row} numbers={numbers} />
      {numbers === "climb" ? (
        <Ladder row={row} />
      ) : (
        <ClimbArrow move={row.move} fresh={row.fresh} was={row.was} />
      )}
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
      className={`row ${hue} ${open ? "is-open" : ""} ${gone ? "is-gone" : ""} ${kept ? "is-kept" : ""} ${print !== null ? "motion-safe:animate-print-in" : ""}`}
      style={
        print !== null ? { animationDelay: `${print.toFixed(2)}s` } : undefined
      }
    >
      {body}
    </article>
  );
}

/** One act's row on its own, as a chart prints it (How it works follows one act, M10b). */
export function ChartRow({
  row,
  numbers,
}: {
  row: ChartRowData;
  numbers: RowNumbers;
}) {
  return (
    <Row
      row={row}
      numbers={numbers}
      open={false}
      kept={false}
      gone={false}
      printDelay={null}
    />
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
  numbers = "place",
  top,
  openId = null,
  keeping = [],
  unavailable = [],
  onOpen,
  printing = null,
  column = 0,
  current = true,
  caption,
  children,
}: {
  band: FeeBand;
  rows: ChartRowData[];
  /** Changes once per re-sort, so the rows' glide plays once. */
  sortKey: unknown;
  motion: boolean;
  /** What an act's big number says; Watch's editions always print their places. */
  numbers?: RowNumbers;
  top?: number;
  openId?: string | null;
  keeping?: readonly string[];
  unavailable?: readonly string[];
  onOpen?: (act: Act) => void;
  /** What prints the rows that mount now. */
  printing?: Printing;
  /** The band's column, 0 or 1, so a replay's two bands print side by side. */
  column?: number;
  /** False while Watch plays the other band's edition: a phone shows only the one playing. */
  current?: boolean;
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
    <section
      aria-labelledby={headingId}
      className={`band numbers-${numbers} ${current ? "" : "band-resting"}`}
    >
      <div className="band-head">
        <h2 id={headingId} className="band-name">
          {PLAIN_BAND[band.id]}
        </h2>
        {!listing && <Slots filled={filled} slots={band.slots} />}
        <FeeRange band={band} />
      </div>
      {/* The climb's one-line key, added after its first readers (evidence section 27). */}
      {numbers === "climb" && rows.some((row) => row.kind === "act") && (
        <p className="numbers-key">
          <Tri />
          places it climbed with its venue&apos;s fans added
        </p>
      )}
      {caption && (
        <p className="band-caption" aria-live="polite">
          {caption}
        </p>
      )}
      <ol className={`rows ${listing ? "rows-listing" : ""}`}>
        {rows.map((row, index) => (
          <li key={row.key} ref={flip(row.key)}>
            {/* Keyed by kind: an edition row that becomes a lineup row mounts afresh and prints in. */}
            <Row
              key={row.kind}
              row={row}
              numbers={row.kind === "act" ? numbers : "place"}
              top={top}
              open={openId !== null && row.act?.entityId === openId}
              kept={keeping.includes(row.act?.entityId ?? "")}
              gone={unavailable.includes(row.act?.entityId ?? "")}
              onOpen={onOpen}
              printDelay={
                !row.act || printing === null
                  ? null
                  : printing === "refill"
                    ? 0
                    : (index * 2 + column) * PRINT_STEP_S
              }
            />
            {row.act && openId === row.act.entityId && children?.(row.act)}
          </li>
        ))}
      </ol>
    </section>
  );
}
