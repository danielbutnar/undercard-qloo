import type { ReactElement } from "react";
import type { PrintPoster } from "./print-words";
import {
  chip,
  DOT,
  fitLines,
  heavy,
  lineCount,
  lineParts,
  NO_BREAK_SPACE,
  rowCount,
  SHARE_COLORS as C,
  SLOT_EDGE,
  textWidth,
  venueInk,
} from "./share-image";
import { capitals, type ShareAct, type ShareBand } from "./share-words";

/**
 * The printable poster as next/og draws it (WS12 item 6): the first screen's poster on its red
 * page, upright, at print size: 1800×2400, 12×16 inches at 150 dpi, a size next/og draws in a
 * few seconds and well under a MB (Daniel, 24 October: under 10 s and a few MB on Vercel). It is
 * drawn as the link preview is (share-image.tsx): inline styles, flexboxes, next/og's own font
 * with a stroke for the heavy face, and every name's size worked out to fit (printLayout). The
 * page and the sheet are flat, without the screen's halftone: at this size next/og takes about
 * ten times as long to draw the dots as the rest of the poster.
 */

export const PRINT_SIZE = { width: 1800, height: 2400 } as const;

// The page's margins, the sheet's shadow, the bar under the sheet with the wordmark, and the
// sheet's border and padding.
const PAGE_PAD = { top: 80, right: 88, bottom: 56, left: 88 };
const SHADOW = 16;
const BAR_H = 76;
const BAR_GAP = 28;
const SHEET_W = PRINT_SIZE.width - PAGE_PAD.left - PAGE_PAD.right - SHADOW;
const SHEET_H =
  PRINT_SIZE.height - PAGE_PAD.top - PAGE_PAD.bottom - BAR_H - BAR_GAP - SHADOW;
const BORDER = 5;
const SHEET_PAD = { v: 72, h: 76 };
/** The width and height inside the sheet's border and padding, which the poster must fit. */
export const SHEET_INNER_W = SHEET_W - 2 * BORDER - 2 * SHEET_PAD.h;
export const SHEET_INNER_H = SHEET_H - 2 * BORDER - 2 * SHEET_PAD.v;

// The gap between the poster's three groups at least, between its blocks, and between chips.
const GROUP_GAP = 48;
const BLOCK_GAP = 40;
const CHIP_GAP = 14;
// Below these, a print stops reading at arm's length: the layout shrinks no further.
const SMALLEST = { chip: 24, text: 22 };

/** A chip's width at `size`: the name in capitals, its mark in the smaller size beside it. */
const actWidth = (act: ShareAct, size: number) => {
  const { climb, padX } = chip(size);
  return (
    textWidth(capitals(act.name), size) +
    (act.climb ? 8 + textWidth(act.climb, climb) : 0) +
    2 * padX +
    8
  );
};
const slotWidth = (text: number) => textWidth("Open slot", text) + 2 * 24 + 6;

/** Each chip's width in a band, its acts then its open slots. */
const bandWidths = (band: ShareBand, size: number, slotText: number) => [
  ...band.acts.map((act) => actWidth(act, size)),
  ...Array.from({ length: band.open }, () => slotWidth(slotText)),
];

/**
 * A band's chip size at most `max`: the largest at which every chip fits the sheet's width, and
 * within that, the one that takes the fewest rows down to three quarters of it.
 */
function bandSize(band: ShareBand, max: number, slotText: number): number {
  let size = max;
  while (
    size > SMALLEST.chip &&
    Math.max(0, ...bandWidths(band, size, slotText)) > SHEET_INNER_W
  )
    size--;
  let best = size;
  let fewest = rowCount(
    bandWidths(band, size, slotText),
    SHEET_INNER_W,
    CHIP_GAP,
  );
  for (let next = size - 1; next >= Math.round(size * 0.75); next--) {
    const rows = rowCount(
      bandWidths(band, next, slotText),
      SHEET_INNER_W,
      CHIP_GAP,
    );
    if (rows < fewest) {
      best = next;
      fewest = rows;
    }
  }
  return best;
}

/** A venue's sign on the key at `size`: its colour's box, its name, then its count. */
const sign = (size: number) => ({
  size,
  count: Math.max(SMALLEST.text - 4, Math.round(size * 0.8)),
  box: Math.round(size * 1.25),
  height: Math.round(size * 1.9),
});
const signWidth = (venue: PrintPoster["venues"][number], size: number) => {
  const { box, count } = sign(size);
  return (
    6 +
    box +
    12 +
    textWidth(capitals(venue.name), size) +
    12 +
    textWidth(venue.acts, count) +
    20 +
    10 +
    6
  );
};

/** A "·"-separated line's height at `size`, wrapping between its parts in the sheet's width. */
const partsHeight = (line: string, size: number) =>
  line
    ? rowCount(
        lineParts(line).map(
          (part, index, parts) =>
            textWidth(part, size) +
            (index < parts.length - 1 ? DOT.size * 2 + 2 * DOT.space * 2 : 0),
        ),
        SHEET_INNER_W,
        0,
      ) *
      size *
      1.3
    : 0;

export interface PrintLayout {
  festival: number;
  facts: number;
  headliners: number[];
  lead: number;
  bandName: number;
  /** Each band's chip size. */
  bands: number[];
  slot: number;
  key: number;
  note: number;
  /** The poster's height as estimated, at most the sheet's. */
  height: number;
}

/** The sizes at `scale` of the largest, and the height they take. */
function layoutAt(poster: PrintPoster, scale: number): PrintLayout {
  const at = (size: number, min = SMALLEST.text) =>
    Math.max(min, Math.round(size * scale));
  const festival = fitLines(
    capitals(poster.festival),
    SHEET_INNER_W,
    at(176),
    2,
  );
  const facts = at(40);
  const headliners = poster.headliners.map((name, index) =>
    fitLines(capitals(name), SHEET_INNER_W, at(index ? 116 : 140), 2),
  );
  const lead = at(46);
  const bandName = at(42);
  const slot = at(30);
  const bands = poster.bands.map((band, index) =>
    bandSize(band, at(index ? 60 : 72, SMALLEST.chip), slot),
  );
  let key = at(32);
  while (
    key > SMALLEST.text &&
    Math.max(0, ...poster.venues.map((venue) => signWidth(venue, key))) >
      SHEET_INNER_W
  )
    key--;
  const note = at(28);

  const top =
    lineCount(capitals(poster.festival), festival, SHEET_INNER_W) *
      festival *
      1.02 +
    16 +
    partsHeight(poster.facts, facts) +
    (6 + 2 * 40) +
    poster.headliners.reduce(
      (sum, name, index) =>
        sum +
        (index ? 18 : 0) +
        lineCount(capitals(name), headliners[index], SHEET_INNER_W) *
          headliners[index] *
          1.04,
      0,
    );
  const leadOneLine =
    textWidth(poster.drafted, lead) + 32 + 16 + textWidth(poster.from, lead) <=
    SHEET_INNER_W;
  const leadH = leadOneLine
    ? lead * 1.2 + 10
    : lead * 1.2 +
      10 +
      8 +
      lineCount(poster.from, lead, SHEET_INNER_W) * lead * 1.2;
  const middle =
    leadH +
    poster.bands.reduce((sum, band, index) => {
      const rows = rowCount(
        bandWidths(band, bands[index], slot),
        SHEET_INNER_W,
        CHIP_GAP,
      );
      return (
        sum +
        BLOCK_GAP +
        bandName * 1.2 +
        16 +
        rows * chip(bands[index]).height +
        (rows - 1) * CHIP_GAP
      );
    }, 0);
  const keyRows = poster.venues.length
    ? rowCount(
        poster.venues.map((venue) => signWidth(venue, key)),
        SHEET_INNER_W,
        CHIP_GAP,
      )
    : 0;
  const bottom =
    (keyRows ? keyRows * sign(key).height + (keyRows - 1) * CHIP_GAP : 0) +
    (keyRows && poster.note ? 24 : 0) +
    partsHeight(poster.note, note);
  return {
    festival,
    facts,
    headliners,
    lead,
    bandName,
    bands,
    slot,
    key,
    note,
    height: top + middle + bottom + 2 * GROUP_GAP,
  };
}

/**
 * The sizes that fit the poster on its sheet: everything at its largest, then a little smaller
 * at a time until the estimated height fits, never below the sizes a print reads at.
 */
export function printLayout(poster: PrintPoster): PrintLayout {
  let layout = layoutAt(poster, 1);
  for (let step = 1; step <= 12 && layout.height > SHEET_INNER_H; step++)
    layout = layoutAt(poster, 1 - step * 0.05);
  return layout;
}

// ---------- the picture ----------

/** A "·"-separated line as the poster sets it: its parts, a drawn dot between them. */
function Parts({ line, size }: { line: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        fontSize: size,
        lineHeight: 1.3,
      }}
    >
      {lineParts(line).map((part, index, parts) => (
        <div key={part} style={{ display: "flex", alignItems: "center" }}>
          <span>{part}</span>
          {index < parts.length - 1 && (
            <div
              style={{
                display: "flex",
                width: DOT.size * 2,
                height: DOT.size * 2,
                margin: `0 ${DOT.space * 2}px`,
                borderRadius: DOT.size,
                backgroundColor: C.ink,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Act({ act, size }: { act: ShareAct; size: number }) {
  const { climb, padX, padTop, padBottom } = chip(size);
  const ink =
    act.hue !== null
      ? venueInk(act.hue)
      : { background: C.ink, color: C.surface };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: `${padTop}px ${padX}px ${padBottom}px`,
        border: `4px solid ${ink.background}`,
        ...ink,
      }}
    >
      <span
        style={{ fontSize: size, lineHeight: 1, ...heavy(size, ink.color) }}
      >
        {capitals(act.name)}
      </span>
      {act.climb && (
        <span
          style={{ fontSize: climb, lineHeight: 1, ...heavy(climb, ink.color) }}
        >
          {act.climb.replaceAll(" ", NO_BREAK_SPACE)}
        </span>
      )}
    </div>
  );
}

function Band({
  band,
  size,
  name,
  slot,
}: {
  band: ShareBand;
  size: number;
  name: number;
  slot: number;
}) {
  const { height } = chip(size);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: name,
          lineHeight: 1.2,
          ...heavy(name, C.ink),
        }}
      >
        {band.name}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: CHIP_GAP,
          width: SHEET_INNER_W,
        }}
      >
        {band.acts.map((act) => (
          <Act key={act.name} act={act} size={size} />
        ))}
        {Array.from({ length: band.open }, (_, index) => (
          <div
            key={`open-${index}`}
            style={{
              display: "flex",
              alignItems: "center",
              height,
              padding: "0 24px",
              border: `3px dashed ${SLOT_EDGE}`,
              color: C.muted,
              fontSize: slot,
            }}
          >
            Open slot
          </div>
        ))}
      </div>
    </div>
  );
}

function VenueSign({
  venue,
  size,
}: {
  venue: PrintPoster["venues"][number];
  size: number;
}) {
  const ink = venueInk(venue.hue);
  const { box, count, height } = sign(size);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        height,
        padding: "0 10px 0 6px",
        border: `3px solid ${C.ink}`,
        backgroundColor: C.surface,
        fontSize: size,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: box,
          height: box,
          border: `3px solid ${C.ink}`,
          backgroundColor: ink.background,
        }}
      >
        <svg
          width={Math.round(box * 0.62)}
          height={Math.round(box * 0.62)}
          viewBox="0 0 16 16"
        >
          <path
            d="M3 8.5 L6.5 12 L13 4.5"
            fill="none"
            stroke={ink.color}
            strokeWidth="2.8"
          />
        </svg>
      </div>
      <span style={{ lineHeight: 1.2, ...heavy(size, C.ink) }}>
        {capitals(venue.name)}
      </span>
      <span
        style={{
          padding: "2px 10px",
          backgroundColor: C.ink,
          color: C.surface,
          fontSize: count,
          lineHeight: 1.2,
        }}
      >
        {venue.acts}
      </span>
    </div>
  );
}

/** The element next/og turns into the printable poster's PNG. */
export function printImage(poster: PrintPoster): ReactElement {
  const layout = printLayout(poster);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: `${PAGE_PAD.top}px ${PAGE_PAD.right}px ${PAGE_PAD.bottom}px ${PAGE_PAD.left}px`,
        backgroundColor: C.page,
        color: C.ink,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          width: SHEET_W + SHADOW,
          height: SHEET_H + SHADOW,
        }}
      >
        {/* The sheet's shadow, a flat ink sheet under it: next/og draws a box-shadow slowly. */}
        <div
          style={{
            position: "absolute",
            left: SHADOW,
            top: SHADOW,
            display: "flex",
            width: SHEET_W,
            height: SHEET_H,
            backgroundColor: C.ink,
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            width: SHEET_W,
            height: SHEET_H,
            padding: `${SHEET_PAD.v}px ${SHEET_PAD.h}px`,
            border: `${BORDER}px solid ${C.ink}`,
            backgroundColor: C.surface,
          }}
        >
          {/* The stamp: a demo festival is fictional; a judge's own is their draft. */}
          <div
            style={{
              position: "absolute",
              top: -34,
              right: -30,
              display: "flex",
              padding: "8px 22px",
              border: `5px solid ${C.danger}`,
              backgroundColor: C.surface,
              color: C.danger,
              fontSize: 40,
              lineHeight: 1.2,
              transform: "rotate(5deg)",
              ...heavy(40, C.danger),
            }}
          >
            {capitals(poster.stamp)}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              width: SHEET_INNER_W,
              height: SHEET_INNER_H,
              textAlign: "center",
            }}
          >
            {/* The festival, its facts and its headliners. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: SHEET_INNER_W,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  fontSize: layout.festival,
                  lineHeight: 1.02,
                  letterSpacing: "0.03em",
                  textAlign: "center",
                  ...heavy(layout.festival, C.ink),
                }}
              >
                {capitals(poster.festival)}
              </div>
              <div style={{ display: "flex", marginTop: 16 }}>
                <Parts line={poster.facts} size={layout.facts} />
              </div>
              <div
                style={{
                  display: "flex",
                  alignSelf: "stretch",
                  height: 6,
                  margin: "40px 0",
                  backgroundColor: C.ink,
                }}
              />
              {poster.headliners.map((name, index) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: index ? 18 : 0,
                    fontSize: layout.headliners[index],
                    lineHeight: 1.04,
                    textAlign: "center",
                    ...heavy(layout.headliners[index], C.ink),
                  }}
                >
                  {capitals(name)}
                </div>
              ))}
            </div>
            {/* The acts Undercard drafted, band by band. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: BLOCK_GAP,
                width: SHEET_INNER_W,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    padding: "4px 14px",
                    border: `3px solid ${C.ink}`,
                    backgroundColor: C.accent,
                    color: C["on-accent"],
                    fontSize: layout.lead,
                    lineHeight: 1.2,
                    ...heavy(layout.lead, C["on-accent"]),
                  }}
                >
                  {poster.drafted}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: layout.lead,
                    lineHeight: 1.2,
                    textAlign: "center",
                    ...heavy(layout.lead, C.ink),
                  }}
                >
                  {poster.from}
                </div>
              </div>
              {poster.bands.map((band, index) => (
                <Band
                  key={band.id}
                  band={band}
                  size={layout.bands[index]}
                  name={layout.bandName}
                  slot={layout.slot}
                />
              ))}
            </div>
            {/* The key: whose fans lifted the acts, in their colours; then the poster's last line. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 24,
                width: SHEET_INNER_W,
              }}
            >
              {poster.venues.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: CHIP_GAP,
                  }}
                >
                  {poster.venues.map((venue) => (
                    <VenueSign
                      key={venue.name}
                      venue={venue}
                      size={layout.key}
                    />
                  ))}
                </div>
              )}
              {poster.note && <Parts line={poster.note} size={layout.note} />}
            </div>
          </div>
        </div>
      </div>
      {/* Under the sheet: the wordmark and what Undercard is. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          height: BAR_H,
          marginTop: BAR_GAP,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 60,
            lineHeight: 1,
            letterSpacing: "0.04em",
            ...heavy(60, C.ink),
          }}
        >
          {capitals(poster.wordmark)}
        </div>
        <div
          style={{
            display: "flex",
            flex: 1,
            fontSize: 24,
            lineHeight: 1.25,
            ...heavy(24, C.ink),
          }}
        >
          {poster.tagline}
        </div>
      </div>
    </div>
  );
}
