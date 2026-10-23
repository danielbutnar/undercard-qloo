import type { ReactElement } from "react";
import {
  capitals,
  type ShareAct,
  type ShareBand,
  type ShareCard,
} from "./share-words";

/**
 * The link preview as next/og draws it (WS10): the first screen's poster on its red page, in
 * one 1200×630 picture. Satori reads inline styles only, so the theme's colours are copied
 * here from src/app/globals.css (a unit test keeps them equal), and every box is a flexbox.
 * The image uses next/og's own font, one weight; a stroke in the text's colour stands in for
 * the poster's heavy display face.
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
// The page's halftone and the sheet's, as globals.css and first-screen.css draw them.
const PAGE_DOTS =
  "radial-gradient(circle at 1px 1px, rgba(11, 11, 12, 0.14) 1px, transparent 1.4px)";
const SHEET_DOTS =
  "radial-gradient(circle at 1px 1px, rgba(11, 11, 12, 0.07) 1px, transparent 1.4px)";
// An open slot's dashed edge: ink at 58% on white (first-screen.css's .poster-slot).
const SLOT_EDGE = "#727273";

const venueInk = (hue: number) => ({
  background: C[`venue-${hue % 6}` as keyof typeof C],
  color: C[`on-venue-${hue % 6}` as keyof typeof C],
});

// The poster's heavy names, drawn in the one weight next/og's font has.
const heavy = (size: number, color: string) => ({
  WebkitTextStroke: `${Math.max(1, Math.round(size / 28))}px ${color}`,
});

// ---------- fitting the names: the image has a fixed size, the names don't ----------

/**
 * About how wide a line of capitals sets, in pixels: a little wider than the font's capitals
 * (Geist's average 0.66 em), so a name the estimate fits always fits.
 */
export function capsWidth(text: string, size: number): number {
  let em = 0;
  for (const char of text)
    em +=
      char === " "
        ? 0.26
        : /[MW]/.test(char)
          ? 0.95
          : /[I1'.,:·]/.test(char)
            ? 0.32
            : 0.72;
  return em * size;
}

/** The largest size from `max` down to `min` at which the longest word fits `width`. */
export function fitWords(
  text: string,
  width: number,
  max: number,
  min: number,
) {
  const longest = Math.max(
    ...text.split(" ").map((word) => capsWidth(word, 1)),
  );
  return Math.max(min, Math.min(max, Math.floor(width / longest)));
}

const GAP = 8;

/** A band's chip: its name's size, and its climb mark's in the body face, as the poster sets it. */
const chip = (size: number) => ({
  size,
  climb: Math.max(13, Math.round(size * 0.55)),
  padX: Math.round(size * 0.38),
});

function chipWidth(act: ShareAct, size: number) {
  const { climb, padX } = chip(size);
  return (
    capsWidth(capitals(act.name), size) +
    (act.climb ? 5 + capsWidth(act.climb, climb) : 0) +
    2 * padX +
    6
  );
}

/** How many rows a band's chips wrap to at `size` in `width`, flex-wrap's way. */
export function bandRows(band: ShareBand, size: number, width: number): number {
  const widths = [
    ...band.acts.map((act) => chipWidth(act, size)),
    ...Array.from({ length: band.open }, () => capsWidth("OPEN SLOT", 15) + 34),
  ];
  let rows = 1;
  let line = 0;
  for (const w of widths) {
    if (line > 0 && line + GAP + w > width) {
      rows++;
      line = w;
    } else line += (line > 0 ? GAP : 0) + w;
  }
  return rows;
}

/** The largest chip size from `max` down to `min` at which a band takes two rows at most. */
export function fitBand(
  band: ShareBand,
  width: number,
  max: number,
  min: number,
) {
  for (let size = max; size > min; size--)
    if (bandRows(band, size, width) <= 2) return size;
  return min;
}

// ---------- the picture ----------

// The sheet's geometry: the page's margins, the sheet's border and padding, the two panels.
const SHEET_W = SHARE_SIZE.width - 40 - 50;
const LEFT_W = 340;
const RIGHT_W = SHEET_W - 6 - 52 - LEFT_W - 51;

function Act({ act, size }: { act: ShareAct; size: number }) {
  const { climb, padX } = chip(size);
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
        padding: `${Math.round(size * 0.34)}px ${padX}px ${Math.round(size * 0.16)}px`,
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
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", fontSize: 19, ...heavy(19, C.ink) }}>
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
              padding: `${Math.round(size * 0.3)}px 15px`,
              border: `2px dashed ${SLOT_EDGE}`,
              color: C.muted,
              fontSize: 15,
            }}
          >
            Open slot
          </div>
        ))}
      </div>
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
  // The first band's names larger, as the poster sets the mid-size acts over the openers.
  const sizes = card.bands.map((band, index) =>
    index === 0
      ? fitBand(band, RIGHT_W, 28, 17)
      : fitBand(band, RIGHT_W, 22, 14),
  );
  const nameSize = fitWords(capitals(card.festival), LEFT_W, 64, 34);
  const headSizes = card.headliners.map((name, index) =>
    fitWords(capitals(name), LEFT_W, index === 0 ? 46 : 36, 22),
  );
  return (
    <div
      style={{
        ...page,
        flexDirection: "column",
        padding: "28px 50px 36px 40px",
      }}
    >
      {/* The top bar: the wordmark and what Undercard is, as the first screen's. */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 22, height: 44 }}
      >
        <Wordmark text={card.wordmark} size={40} />
        <div style={{ display: "flex", fontSize: 22, ...heavy(22, C.ink) }}>
          {card.tagline}
        </div>
      </div>
      {/* The poster: the festival on the left, the drafted acts on the right. */}
      <div
        style={{
          position: "relative",
          display: "flex",
          marginTop: 22,
          width: SHEET_W,
          flexGrow: 1,
          padding: "22px 26px",
          border: `3px solid ${C.ink}`,
          boxShadow: `10px 10px 0 ${C.ink}`,
          backgroundColor: C.surface,
          backgroundImage: SHEET_DOTS,
          backgroundSize: "6px 6px",
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
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: nameSize,
              lineHeight: 1.02,
              letterSpacing: "0.03em",
              textAlign: "center",
              ...heavy(nameSize, C.ink),
            }}
          >
            {capitals(card.festival)}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 10,
              fontSize: 19,
              lineHeight: 1.3,
            }}
          >
            {card.facts}
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
          <div
            style={{
              display: "flex",
              padding: "3px 11px",
              backgroundColor: C.ink,
              color: C.surface,
              fontSize: 18,
              ...heavy(18, C.surface),
            }}
          >
            {card.booked}
          </div>
          {card.headliners.map((name, index) => (
            <div
              key={name}
              style={{
                display: "flex",
                marginTop: index === 0 ? 14 : 8,
                fontSize: headSizes[index],
                lineHeight: 1.04,
                textAlign: "center",
                ...heavy(headSizes[index], C.ink),
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
            margin: "0 24px",
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
            gap: 14,
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
                fontSize: 24,
                ...heavy(24, C["on-accent"]),
              }}
            >
              {card.drafted}
            </div>
            <div style={{ display: "flex", fontSize: 24, ...heavy(24, C.ink) }}>
              {card.from}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {card.venues.map((venue) => (
              <div
                key={venue.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 7px 5px 5px",
                  border: `2px solid ${C.ink}`,
                  backgroundColor: C.surface,
                  fontSize: 16,
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
                    backgroundColor: venueInk(venue.hue).background,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16">
                    <path
                      d="M3 8.5 L6.5 12 L13 4.5"
                      fill="none"
                      stroke={venueInk(venue.hue).color}
                      strokeWidth="2.8"
                    />
                  </svg>
                </div>
                <span style={{ ...heavy(16, C.ink) }}>
                  {capitals(venue.name)}
                </span>
                <span
                  style={{
                    padding: "1px 6px",
                    backgroundColor: C.ink,
                    color: C.surface,
                    fontSize: 14,
                  }}
                >
                  {venue.acts}
                </span>
              </div>
            ))}
          </div>
          {card.bands.map((band, index) => (
            <Band key={band.id} band={band} size={sizes[index]} />
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
