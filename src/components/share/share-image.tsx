import type { ReactElement } from "react";
import {
  capitals,
  type ShareAct,
  type ShareBand,
  type ShareCard,
  type ShareVenue,
} from "./share-words";

/**
 * The link preview as next/og draws it (WS10): the first screen's poster on its red page, in
 * one 1200×630 picture. Satori reads inline styles only, so the theme's colours are copied
 * here from src/app/globals.css (a unit test keeps them equal), and every box is a flexbox.
 * The image uses next/og's own font, one weight; a stroke in the text's colour stands in for
 * the poster's heavy display face. The picture has a fixed size and the names don't, so the
 * names' sizes are worked out to fit (posterLayout).
 */

export const SHARE_SIZE = { width: 1200, height: 630 } as const;

/** The theme tokens the picture uses, as globals.css defines them. */
export const SHARE_COLORS = {
  page: "#ff3b2a",
  surface: "#ffffff",
  ink: "#0b0b0c",
  muted: "#4a4f57",
  accent: "#ffd60a",
  "on-accent": "#0b0b0c",
  danger: "#b3261e",
  "venue-0": "#1d4ed8",
  "on-venue-0": "#ffffff",
  "venue-1": "#22c3e6",
  "on-venue-1": "#0b0b0c",
  "venue-2": "#9bd13b",
  "on-venue-2": "#0b0b0c",
  "venue-3": "#b5175f",
  "on-venue-3": "#ffffff",
  "venue-4": "#0e7a50",
  "on-venue-4": "#ffffff",
  "venue-5": "#f2b84b",
  "on-venue-5": "#0b0b0c",
} as const;

const C = SHARE_COLORS;
// The page's halftone and the sheet's, as globals.css and first-screen.css draw them: a 1px dot
// of ink at 14% every 9px, and at 7% every 6px. Satori draws a centred circle only, and sizes px
// stops by the whole element, so the stops are shares of the tile's corner distance instead.
const PAGE_DOTS =
  "radial-gradient(circle, rgba(11, 11, 12, 0.14) 16%, transparent 22%)";
const SHEET_DOTS =
  "radial-gradient(circle, rgba(11, 11, 12, 0.07) 24%, transparent 33%)";
// An open slot's dashed edge: ink at 58% on white (first-screen.css's .poster-slot).
export const SLOT_EDGE = "#727273";

export const venueInk = (hue: number) => ({
  background: C[`venue-${hue % 6}` as keyof typeof C],
  color: C[`on-venue-${hue % 6}` as keyof typeof C],
});

export const NO_BREAK_SPACE = String.fromCharCode(0xa0);

/**
 * A "·"-separated line in the parts it wraps between. Satori measures a word letter by letter
 * but draws it kerned, so a kerned word leaves a gap after it, and Geist's "·" sits off centre:
 * each part is set with no-break spaces, as one word, and the dots between parts are drawn.
 */
export const lineParts = (line: string) =>
  line.split(" · ").map((part) => part.replaceAll(" ", NO_BREAK_SPACE));
// A drawn dot between two parts: its width and the space on each side.
export const DOT = { size: 4, space: 7 };

// The poster's heavy names, drawn in the one weight next/og's font has.
export const heavy = (size: number, color: string) => ({
  WebkitTextStroke: `${Math.max(1, Math.round(size / 28))}px ${color}`,
});

// ---------- fitting the names ----------

// The advance widths of next/og's own font (Geist Regular), in thousandths of an em: A to Z,
// a to z and 0 to 9, read from its hmtx table. Anything else counts as a wide letter.
const CAPITAL_WIDTHS = [
  668, 680, 703, 694, 603, 590, 700, 713, 270, 597, 640, 580, 877, 743, 739,
  650, 733, 672, 640, 552, 689, 667, 945, 606, 576, 544,
];
const SMALL_WIDTHS = [
  551, 595, 546, 595, 561, 395, 594, 581, 244, 260, 590, 267, 877, 581, 573,
  595, 595, 379, 520, 392, 575, 536, 819, 585, 537, 537,
];
const DIGIT_WIDTHS = [663, 384, 619, 613, 615, 626, 593, 524, 604, 593];

function advance(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= 65 && code <= 90) return CAPITAL_WIDTHS[code - 65];
  if (code >= 97 && code <= 122) return SMALL_WIDTHS[code - 97];
  if (code >= 48 && code <= 57) return DIGIT_WIDTHS[code - 48];
  if (char === " " || char === NO_BREAK_SPACE) return 250;
  if (/[.,:;'·!|]/.test(char)) return 300;
  return 720;
}

/**
 * About how wide a line of text sets, in pixels: 5% wider than the font sets it, for the stroke
 * and the rounding, so text the estimate fits always fits.
 */
export function textWidth(text: string, size: number): number {
  let width = 0;
  for (const char of text) width += advance(char);
  return (width / 1000) * size * 1.05;
}

/** How many lines a text wraps to at `size` in `width`, breaking at spaces only. */
export function lineCount(text: string, size: number, width: number): number {
  let lines = 1;
  let line = 0;
  for (const word of text.split(" ")) {
    const w = textWidth(word, size);
    const space = textWidth(" ", size);
    if (line > 0 && line + space + w > width) {
      lines++;
      line = w;
    } else line += (line > 0 ? space : 0) + w;
  }
  return lines;
}

/** The largest size from `max` down to `min` that sets `text` in `lines` lines or fewer. */
export function fitLines(
  text: string,
  width: number,
  max: number,
  lines: number,
  min = 12,
): number {
  for (let size = max; size > min; size--) {
    const longest = Math.max(
      ...text.split(" ").map((word) => textWidth(word, size)),
    );
    if (longest <= width && lineCount(text, size, width) <= lines) return size;
  }
  return min;
}

/** How many rows boxes of these widths wrap to in `width`, flex-wrap's way. */
export function rowCount(
  widths: readonly number[],
  width: number,
  gap: number,
) {
  let rows = 1;
  let line = 0;
  for (const w of widths) {
    if (line > 0 && line + gap + w > width) {
      rows++;
      line = w;
    } else line += (line > 0 ? gap : 0) + w;
  }
  return rows;
}

const GAP = 8;
const SLOT_TEXT = 15;

/** A band's chip at `size`: its climb mark set in the body face, smaller, as the poster sets it. */
export const chip = (size: number) => ({
  size,
  climb: Math.min(size, Math.max(12, Math.round(size * 0.55))),
  padX: Math.round(size * 0.38),
  padTop: Math.round(size * 0.34),
  padBottom: Math.round(size * 0.16),
  height: size + Math.round(size * 0.34) + Math.round(size * 0.16) + 6,
});

const actWidth = (act: ShareAct, size: number) => {
  const { climb, padX } = chip(size);
  return (
    textWidth(capitals(act.name), size) +
    (act.climb ? 5 + textWidth(act.climb, climb) : 0) +
    2 * padX +
    6
  );
};

/** How many rows a band's chips take at `size` in `width`. */
export function bandRows(band: ShareBand, size: number, width: number) {
  return rowCount(
    [
      ...band.acts.map((act) => actWidth(act, size)),
      ...Array.from(
        { length: band.open },
        () => textWidth("Open slot", SLOT_TEXT) + 34,
      ),
    ],
    width,
    GAP,
  );
}

/**
 * A band's chip size at most `max`: the largest that takes the fewest rows down to three
 * quarters of `max`, so a band sets as two full rows rather than three with one name left over.
 */
export function bandSize(band: ShareBand, max: number): number {
  let best = max;
  let fewest = bandRows(band, max, RIGHT_W);
  for (let size = max - 1; size >= Math.round(max * 0.75); size--) {
    const rows = bandRows(band, size, RIGHT_W);
    if (rows < fewest) {
      best = size;
      fewest = rows;
    }
  }
  return best;
}

const KEY_TEXT = 16;
const COUNT_TEXT = 14;
const venueWidth = (venue: ShareVenue) =>
  5 +
  28 +
  8 +
  textWidth(capitals(venue.name), KEY_TEXT) +
  8 +
  textWidth(venue.acts, COUNT_TEXT) +
  12 +
  7 +
  4;

// The picture's geometry: the page's margins, the top bar, the sheet's border and padding, and
// the sheet's two panels with the rule between them.
const PAGE_PAD = { top: 28, right: 50, bottom: 36, left: 40 };
const BAR_H = 44;
const BAR_GAP = 22;
const SHEET_W = SHARE_SIZE.width - PAGE_PAD.left - PAGE_PAD.right;
const SHEET_H =
  SHARE_SIZE.height - PAGE_PAD.top - BAR_H - BAR_GAP - PAGE_PAD.bottom;
const SHEET_PAD = { v: 22, h: 26 };
/** The height inside the sheet's border and padding, which each panel's content must fit. */
export const INNER_H = SHEET_H - 6 - 2 * SHEET_PAD.v;
const LEFT_W = 340;
const RULE_GAP = 24;
const RIGHT_W = SHEET_W - 6 - 2 * SHEET_PAD.h - LEFT_W - 3 - 2 * RULE_GAP;
const BLOCK_GAP = 14;
const LEAD_TEXT = 24;
const FACTS_TEXT = 19;
const BAND_TEXT = 19;

export interface PosterLayout {
  festival: number;
  headliners: number[];
  bands: number[];
  /** The panels' heights as estimated, each within the sheet's. */
  left: number;
  right: number;
}

/**
 * The sizes that fit the poster's names in the sheet: the festival's name and each headliner on
 * two lines at most, each band's chips as large as the right panel's height allows, the first
 * band's larger, as the poster sets the mid-size acts over the openers.
 */
export function posterLayout(
  card: Extract<ShareCard, { kind: "poster" }>,
): PosterLayout {
  const facts =
    rowCount(
      lineParts(card.facts).map(
        (part, index, parts) =>
          textWidth(part, FACTS_TEXT) +
          (index < parts.length - 1 ? DOT.size + 2 * DOT.space : 0),
      ),
      LEFT_W,
      0,
    ) *
    FACTS_TEXT *
    1.3;
  // The left panel: the festival's name, its facts, the rule, the headliners.
  const leftAt = (scale: number) => {
    const festival = fitLines(
      capitals(card.festival),
      LEFT_W,
      Math.round(64 * scale),
      2,
    );
    const headliners = card.headliners.map((name, index) =>
      fitLines(
        capitals(name),
        LEFT_W,
        Math.round((index ? 36 : 46) * scale),
        2,
      ),
    );
    const left =
      lineCount(capitals(card.festival), festival, LEFT_W) * festival * 1.02 +
      10 +
      facts +
      39 +
      28 +
      card.headliners.reduce(
        (sum, name, index) =>
          sum +
          (index ? 8 : 14) +
          lineCount(capitals(name), headliners[index], LEFT_W) *
            headliners[index] *
            1.04,
        0,
      );
    return { festival, headliners, left };
  };
  let left = leftAt(1);
  for (let step = 1; step <= 10 && left.left > INNER_H; step++)
    left = leftAt(1 - step * 0.05);

  const lead = textWidth(card.drafted, LEAD_TEXT) + 24;
  const from = textWidth(card.from, LEAD_TEXT);
  const leadH =
    lead + 10 + from <= RIGHT_W
      ? LEAD_TEXT * 1.2 + 8
      : LEAD_TEXT * 1.2 +
        8 +
        4 +
        lineCount(card.from, LEAD_TEXT, RIGHT_W) * LEAD_TEXT * 1.2;
  const keyRows = rowCount(card.venues.map(venueWidth), RIGHT_W, GAP);
  const keyH = card.venues.length ? keyRows * 38 + (keyRows - 1) * GAP : 0;
  // The right panel: the lead, the venues' signs, then each band's name and chips.
  const rightAt = (scale: number) => {
    const bands = card.bands.map((band, index) =>
      bandSize(band, Math.round((index ? 22 : 28) * scale)),
    );
    const right =
      leadH +
      BLOCK_GAP +
      keyH +
      card.bands.reduce((sum, band, index) => {
        const rows = bandRows(band, bands[index], RIGHT_W);
        return (
          sum +
          BLOCK_GAP +
          BAND_TEXT * 1.2 +
          GAP +
          rows * chip(bands[index]).height +
          (rows - 1) * GAP
        );
      }, 0);
    return { bands, right };
  };
  let { bands, right } = rightAt(1);
  for (let step = 1; step <= 10 && right > INNER_H; step++)
    ({ bands, right } = rightAt(1 - step * 0.05));
  return { ...left, bands, right };
}

// ---------- the picture ----------

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
        gap: 5,
        padding: `${padTop}px ${padX}px ${padBottom}px`,
        border: `3px solid ${ink.background}`,
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
          {act.climb}
        </span>
      )}
    </div>
  );
}

function Band({ band, size }: { band: ShareBand; size: number }) {
  const { height } = chip(size);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: GAP,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: BAND_TEXT,
          lineHeight: 1.2,
          ...heavy(BAND_TEXT, C.ink),
        }}
      >
        {band.name}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: GAP,
          width: RIGHT_W,
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
              padding: "0 15px",
              border: `2px dashed ${SLOT_EDGE}`,
              color: C.muted,
              fontSize: SLOT_TEXT,
            }}
          >
            Open slot
          </div>
        ))}
      </div>
    </div>
  );
}

function VenueSign({ venue }: { venue: ShareVenue }) {
  const ink = venueInk(venue.hue);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 38,
        padding: "0 7px 0 5px",
        border: `2px solid ${C.ink}`,
        backgroundColor: C.surface,
        fontSize: KEY_TEXT,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          border: `2px solid ${C.ink}`,
          backgroundColor: ink.background,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16">
          <path
            d="M3 8.5 L6.5 12 L13 4.5"
            fill="none"
            stroke={ink.color}
            strokeWidth="2.8"
          />
        </svg>
      </div>
      <span style={{ lineHeight: 1.2, ...heavy(KEY_TEXT, C.ink) }}>
        {capitals(venue.name)}
      </span>
      <span
        style={{
          padding: "1px 6px",
          backgroundColor: C.ink,
          color: C.surface,
          fontSize: COUNT_TEXT,
          lineHeight: 1.2,
        }}
      >
        {venue.acts}
      </span>
    </div>
  );
}

function Wordmark({ text, size }: { text: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "0.04em",
        color: C.ink,
        ...heavy(size, C.ink),
      }}
    >
      {capitals(text)}
    </div>
  );
}

const page = {
  display: "flex",
  width: "100%",
  height: "100%",
  backgroundColor: C.page,
  backgroundImage: PAGE_DOTS,
  backgroundSize: "9px 9px",
  backgroundRepeat: "repeat",
  color: C.ink,
} as const;

function Plain({ card }: { card: Extract<ShareCard, { kind: "plain" }> }) {
  return (
    <div
      style={{
        ...page,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        padding: "0 120px",
      }}
    >
      <Wordmark text={card.wordmark} size={132} />
      <div
        style={{
          display: "flex",
          fontSize: 32,
          lineHeight: 1.35,
          textAlign: "center",
        }}
      >
        {card.tagline}
      </div>
    </div>
  );
}

function Poster({ card }: { card: Extract<ShareCard, { kind: "poster" }> }) {
  const layout = posterLayout(card);
  return (
    <div
      style={{
        ...page,
        flexDirection: "column",
        padding: `${PAGE_PAD.top}px ${PAGE_PAD.right}px ${PAGE_PAD.bottom}px ${PAGE_PAD.left}px`,
      }}
    >
      {/* The top bar: the wordmark and what Undercard is, as the first screen's. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          height: BAR_H,
        }}
      >
        <Wordmark text={card.wordmark} size={40} />
        <div
          style={{
            display: "flex",
            fontSize: 22,
            lineHeight: 1.2,
            ...heavy(22, C.ink),
          }}
        >
          {card.tagline}
        </div>
      </div>
      {/* The poster: the festival on the left, the drafted acts on the right. */}
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: BAR_GAP,
          width: SHEET_W,
          height: SHEET_H,
          padding: `${SHEET_PAD.v}px ${SHEET_PAD.h}px`,
          border: `3px solid ${C.ink}`,
          boxShadow: `10px 10px 0 ${C.ink}`,
          backgroundColor: C.surface,
          backgroundImage: SHEET_DOTS,
          backgroundSize: "6px 6px",
          backgroundRepeat: "repeat",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -20,
            right: -16,
            display: "flex",
            padding: "4px 11px",
            border: `3px solid ${C.danger}`,
            backgroundColor: C.surface,
            color: C.danger,
            fontSize: 18,
            lineHeight: 1.2,
            transform: "rotate(6deg)",
            ...heavy(18, C.danger),
          }}
        >
          {card.stamp}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: LEFT_W,
            height: INNER_H,
            overflow: "hidden",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: layout.festival,
              lineHeight: 1.02,
              letterSpacing: "0.03em",
              textAlign: "center",
              ...heavy(layout.festival, C.ink),
            }}
          >
            {capitals(card.festival)}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: 10,
              fontSize: FACTS_TEXT,
              lineHeight: 1.3,
            }}
          >
            {lineParts(card.facts).map((part, index, parts) => (
              <div key={part} style={{ display: "flex", alignItems: "center" }}>
                <span>{part}</span>
                {index < parts.length - 1 && (
                  <div
                    style={{
                      display: "flex",
                      width: DOT.size,
                      height: DOT.size,
                      margin: `0 ${DOT.space}px`,
                      borderRadius: DOT.size / 2,
                      backgroundColor: C.ink,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignSelf: "stretch",
              height: 3,
              margin: "18px 0",
              backgroundColor: C.ink,
            }}
          />
          {card.headliners.map((name, index) => (
            <div
              key={name}
              style={{
                display: "flex",
                marginTop: index === 0 ? 14 : 8,
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
        <div
          style={{
            display: "flex",
            width: 3,
            margin: `0 ${RULE_GAP}px`,
            backgroundColor: C.ink,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: RIGHT_W,
            height: INNER_H,
            gap: BLOCK_GAP,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "4px 10px",
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "2px 10px",
                border: `2px solid ${C.ink}`,
                backgroundColor: C.accent,
                color: C["on-accent"],
                fontSize: LEAD_TEXT,
                lineHeight: 1.2,
                ...heavy(LEAD_TEXT, C["on-accent"]),
              }}
            >
              {card.drafted}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: LEAD_TEXT,
                lineHeight: 1.2,
                textAlign: "center",
                ...heavy(LEAD_TEXT, C.ink),
              }}
            >
              {card.from}
            </div>
          </div>
          {card.venues.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: GAP,
              }}
            >
              {card.venues.map((venue) => (
                <VenueSign key={venue.name} venue={venue} />
              ))}
            </div>
          )}
          {card.bands.map((band, index) => (
            <Band key={band.id} band={band} size={layout.bands[index]} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The element next/og turns into the preview's PNG. */
export function shareImage(card: ShareCard): ReactElement {
  return card.kind === "plain" ? <Plain card={card} /> : <Poster card={card} />;
}
