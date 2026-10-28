import type { Metadata } from "next";
import type { FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { FirstBill } from "@/lib/first-bill";
import type { Act, Venue } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import { SAGEBRUSH_SOUND } from "@/lib/sagebrush";
import type { Placed } from "@/lib/venue-switch";
import { venueHues } from "@/lib/venue-colours";
import {
  climbMark,
  LEAD_TITLE,
  leadLine,
  signChip,
  stampWords,
  TAGLINE_LEAD,
  TAGLINE_QLOO,
} from "../chart/poster-words";
import { factsLine, PLAIN_BAND } from "../chart/words";

/**
 * What the link preview says (WS10): the first screen's poster in one picture, worked out from
 * the saved build the page reads (src/server/first-bill.ts), in the page's own words
 * (poster-words.ts, words.ts). Nothing here holds a name or a number of its own.
 */

export const SHARE_WORDMARK = "Undercard";
export const SHARE_DRAFTED = "Drafted by Undercard";

/** Daniel's line for the preview (WS10 brief): whose fans drafted the acts. */
export const draftedFrom = (city: string) =>
  `from what fans of ${city}'s music venues like`;

/**
 * A page's link-preview tags, in the first screen's words: its lead for the title, its tagline
 * for the description, and Twitter's large-image card. The picture is the page's
 * opengraph-image route, which Next.js adds to both.
 */
export function shareMetadata(festival: Festival) {
  const lead = leadLine(festival, false);
  const title = `${LEAD_TITLE} ${lead.mark} ${lead.rest}`;
  const description = `${TAGLINE_LEAD} ${TAGLINE_QLOO}`;
  return {
    openGraph: {
      title,
      description,
      siteName: SHARE_WORDMARK,
      type: "website" as const,
    },
    twitter: { card: "summary_large_image" as const, title, description },
  } satisfies Metadata;
}

/**
 * The picture's alt text. A route's alt text can't read its params, so the towns' route has one
 * for every town (`null`).
 */
export function shareAlt(festival: Festival | null): string {
  const shows = (whose: string) =>
    `its booked headliners, then the acts Undercard drafted from what fans of ${whose} music venues like, each in its venue's colour.`;
  return festival
    ? `${festival.name}, a fictional festival in ${festival.city}, ${festival.region}: ${shows(`${festival.city}'s`)}`
    : `${SAGEBRUSH_SOUND.name}, a fictional festival: ${shows("the town's")}`;
}

export interface ShareVenue {
  name: string;
  /** Its colour on the poster (src/lib/venue-colours.ts). */
  hue: number;
  /** "7 acts": the acts its fans lifted onto the poster, as the town's sign says it. */
  acts: string;
}

export interface ShareAct {
  name: string;
  /** Its venue's colour; null when the poster has none for it. */
  hue: number | null;
  /** "↑26" or "NEW", as on its poster name; null when the build can't tell. */
  climb: string | null;
}

export interface ShareBand {
  id: FeeBandId;
  name: string;
  acts: ShareAct[];
  open: number;
}

export type ShareCard =
  | {
      kind: "poster";
      wordmark: string;
      tagline: string;
      stamp: string;
      festival: string;
      facts: string;
      headliners: string[];
      drafted: string;
      from: string;
      venues: ShareVenue[];
      bands: ShareBand[];
    }
  | { kind: "plain"; wordmark: string; tagline: string };

// The code points next/og's own font (Geist Regular, bundled with Next.js) draws, of those a name
// is likely to hold: ASCII; Latin-1 but the soft hyphen; Latin Extended-A but the 11 letters it
// lacks (Ĕ ĕ Ĭ ĭ ĸ Ŀ ŀ ŉ Ŏ ŏ ſ); the dashes, quotes, bullet and ellipsis; and ↑. Satori fetches a
// font from Google for any character its fonts lack, so the preview never draws one.
const DRAWABLE: readonly (readonly [number, number])[] = [
  [0x20, 0x7e],
  [0xa0, 0xac],
  [0xae, 0x113],
  [0x116, 0x12b],
  [0x12e, 0x137],
  [0x139, 0x13e],
  [0x141, 0x148],
  [0x14a, 0x14d],
  [0x150, 0x17e],
  [0x2013, 0x2014],
  [0x2018, 0x2019],
  [0x201c, 0x201d],
  [0x2022, 0x2022],
  [0x2026, 0x2026],
  [0x2191, 0x2191],
];
const canDraw = (char: string) => {
  const code = char.codePointAt(0)!;
  return DRAWABLE.some(([from, to]) => code >= from && code <= to);
};
// The hyphens the font lacks (U+2010 to U+2012), and the horizontal bar (U+2015).
const HYPHENS = [0x2010, 0x2011, 0x2012];
const BAR = 0x2015;

/**
 * A name as the image can draw it: a letter the font lacks loses its accent ("Ŏ" → "O"), a
 * hyphen becomes "-", and whatever it still can't draw is left out.
 */
export function drawable(text: string): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    const code = char.codePointAt(0)!;
    if (canDraw(char)) out += char;
    else if (HYPHENS.includes(code)) out += "-";
    else if (code === BAR) out += "—";
    else
      for (const part of char.normalize("NFKD")) if (canDraw(part)) out += part;
  }
  return out.replace(/\s+/g, " ").trim();
}
/** A name in the poster's capitals, as the image can draw it. */
export const capitals = (text: string) => drawable(text.toUpperCase());

/** A venue's name on its sign: without a bracketed note (town-scene.tsx's signName). */
export const signName = (name: string) =>
  name.replace(/\s*\([^)]*\)/g, "").trim() || name;

// The lineup's order on the poster (chart-rows.ts, billRows by climb): the biggest climb first, a
// new entry as a climb from 51st, then the lower place. The chart's top is Qloo's 50
// (band-chart.tsx's TOP), a client module this server picture can't import.
const TOP = 50;
function byClimb(
  acts: readonly Act[],
  places: Readonly<Record<string, Placed>>,
) {
  const row = (act: Act) => {
    const lift = liftOf(act);
    const place =
      places[act.entityId]?.now ?? (lift?.kind === "new" ? lift.top : null);
    const climb =
      lift?.kind === "new"
        ? TOP + 1 - (place ?? TOP)
        : lift?.kind === "up"
          ? lift.places
          : 0;
    return { act, climb, place: place ?? 999 };
  };
  return acts
    .map(row)
    .sort((a, b) => b.climb - a.climb || a.place - b.place)
    .map(({ act }) => act);
}

/**
 * The preview for a festival's latest saved build: the poster's festival, headliners, the venues
 * whose fans lifted acts and each band's acts in their venue's colour. With no saved build, a
 * plain card: the wordmark and what Undercard is.
 */
export function shareCard(
  festival: Festival,
  bill: FirstBill | null,
): ShareCard {
  if (!bill)
    return {
      kind: "plain",
      wordmark: SHARE_WORDMARK,
      tagline: `${TAGLINE_LEAD} ${TAGLINE_QLOO}`,
    };
  // The venues the build read, band by band, then any act's own: the poster's first paint
  // (festival-screen.tsx), so each venue keeps the poster's colour.
  const read = new Map<string, Venue>();
  for (const band of festival.feeBands)
    for (const venue of bill.anchors[band.id] ?? [])
      if (!read.has(venue.entityId)) read.set(venue.entityId, venue);
  for (const act of bill.acts)
    if (!read.has(act.anchorVenue.entityId))
      read.set(act.anchorVenue.entityId, act.anchorVenue);
  const venues = [...read.values()];
  const hues = venueHues(venues, bill.acts);
  const lifted = (id: string) =>
    bill.acts.filter((act) => act.anchorVenue.entityId === id).length;
  return {
    kind: "poster",
    wordmark: SHARE_WORDMARK,
    tagline: TAGLINE_LEAD.replace(/,$/, ""),
    stamp: stampWords(false),
    festival: drawable(festival.name),
    facts: drawable(factsLine(festival)),
    headliners: festival.headliners.map(drawable),
    drafted: SHARE_DRAFTED,
    from: drawable(draftedFrom(festival.city)),
    // The town's signs, strongest first: only the venues whose fans lifted an act.
    venues: venues
      .map((venue, index) => ({ venue, index, count: lifted(venue.entityId) }))
      .filter(({ count }) => count > 0)
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .map(({ venue, count }) => ({
        name: drawable(signName(venue.name)),
        hue: hues.get(venue.entityId) ?? 0,
        acts: signChip({ lifted: count }),
      })),
    bands: festival.feeBands.map((band) => {
      const acts = byClimb(
        bill.acts.filter((act) => act.band === band.id),
        bill.places ?? {},
      );
      return {
        id: band.id,
        name: PLAIN_BAND[band.id],
        open: Math.max(0, band.slots - acts.length),
        acts: acts.map((act) => ({
          name: drawable(act.name),
          hue: hues.get(act.anchorVenue.entityId) ?? null,
          climb: climbMark(act),
        })),
      };
    }),
  };
}
