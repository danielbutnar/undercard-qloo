import { z } from "zod";
import { FEE_BAND_IDS, type FeeBandId } from "@/lib/fee-bands";
import type { Festival } from "@/lib/festival";
import type { Act } from "@/lib/lineup";
import { liftOf } from "@/lib/marks";
import { festivalById } from "@/lib/towns";
import {
  yourFestival,
  YourBriefSchema,
  type YourBrief,
} from "@/lib/your-festival";
import {
  footnote,
  signChip,
  stampWords,
  TAGLINE_LEAD,
  TAGLINE_QLOO,
} from "../chart/poster-words";
import { factsLine, ordinal, PLAIN_BAND } from "../chart/words";
import {
  drawable,
  draftedFrom,
  SHARE_DRAFTED,
  SHARE_WORDMARK,
  type ShareBand,
  type ShareVenue,
  signName,
} from "./share-words";

/**
 * The printable poster (WS12 item 6): the poster on screen, sent by the page to /api/poster and
 * drawn there with next/og at print size (print-image.tsx). What prints is what the poster
 * shows, so a refill or a venue switched off prints too; the server decides all it can itself:
 * a demo festival's own name, facts and headliners, each band's name, and the stamp.
 */

/** The stamp on every demo festival's print: the festival is invented. */
export const PRINT_STAMP = "Fictional demo festival";

// A judge's own festival (src/components/your-festival.tsx): a live run's id, never saved.
const OWN_ID = /^yours-draft-\d{1,9}$/;
// A name longer than a poster line takes is clipped with an ellipsis; a request's names may run
// to 200 characters, and anything longer isn't a name.
const LINE = 60;
const TEXT = z.string().trim().min(1).max(200);
const HUE = z.number().int().min(0).max(5);
const PLACE = z.number().int().min(1).max(999);

const ClimbSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("up"), places: PLACE }),
  z.object({ kind: z.literal("new") }),
]);

export const PrintRequestSchema = z.object({
  /** The festival's id: a demo town's (TOWNS, the checked towns) or a judge's own. */
  festival: z.string().min(1).max(80),
  /** A judge's own festival only: its brief, from which the server makes its words. */
  brief: YourBriefSchema.optional(),
  /** The venues whose fans lifted a printed act, each with how many. */
  venues: z
    .array(
      z.object({ name: TEXT, hue: HUE, acts: z.number().int().min(1).max(99) }),
    )
    .max(12),
  /** The festival's bands, in its order, each with its acts as the poster orders them. */
  bands: z
    .array(
      z.object({
        id: z.enum(FEE_BAND_IDS),
        acts: z
          .array(
            z.object({
              name: TEXT,
              hue: HUE.nullable(),
              /** Its place in Qloo's ranking now. */
              place: PLACE.nullable(),
              climb: ClimbSchema.nullable(),
            }),
          )
          .max(12),
        open: z.number().int().min(0).max(12),
      }),
    )
    .min(1)
    .max(FEE_BAND_IDS.length),
});

export type PrintRequest = z.infer<typeof PrintRequestSchema>;
type PrintClimb = PrintRequest["bands"][number]["acts"][number]["climb"];

export interface PrintPoster {
  wordmark: string;
  /** What Undercard is, under the wordmark. */
  tagline: string;
  stamp: string;
  festival: string;
  facts: string;
  headliners: string[];
  drafted: string;
  from: string;
  /** The key: the venues whose fans lifted a printed act, strongest first. */
  venues: ShareVenue[];
  /** Each band's acts in the poster's order; an act's climb is its mark, "5th ↑14". */
  bands: ShareBand[];
  /** The poster's last line (poster-words.ts's footnote); empty when it has none. */
  note: string;
  /** The PNG's file name. */
  file: string;
}

const clip = (name: string) =>
  name.length > LINE ? `${name.slice(0, LINE - 1).trim()}…` : name;

/** A demo festival: one of the towns' (Boise's brief in another town) or a checked town's. */
const isDemo = (festival: Pick<Festival, "id">) =>
  festivalById(festival.id) !== null;

/** The PNG's file name: a demo festival's says it's the fictional demo festival. */
export const posterFile = (festival: Pick<Festival, "id">) =>
  isDemo(festival)
    ? `${festival.id}-fictional-demo-festival-poster.png`
    : `${festival.id}-poster.png`;

/** Export CSV's file name, which says so too on a demo festival (WS12 item 7). */
export const csvFile = (festival: Pick<Festival, "id">) =>
  isDemo(festival)
    ? `${festival.id}-fictional-demo-festival-undercard.csv`
    : `${festival.id}-undercard.csv`;

/** Export CSV's first line on a demo festival (WS12 item 7); a judge's own has none. */
export const csvNote = (
  festival: Pick<Festival, "id" | "name" | "city" | "region">,
): string | null =>
  isDemo(festival)
    ? `${PRINT_STAMP}: ${festival.name} in ${festival.city}, ${festival.region}, drafted by Undercard`
    : null;

/** An act's mark, as its name on the poster carries it: its place over its climb. */
function markOf(place: number | null, climb: PrintClimb): string | null {
  if (!climb) return null;
  const rank = place !== null ? `${ordinal(place)} ` : "";
  return `${rank}${climb.kind === "new" ? "NEW" : `↑${climb.places}`}`;
}

/**
 * The poster the server prints for a request, or null for one it can't vouch for: a festival it
 * doesn't know, a judge's own festival without its brief, bands that aren't the festival's own
 * in its order, or more acts and open slots than a band has slots.
 */
export function printPoster(request: unknown): PrintPoster | null {
  const parsed = PrintRequestSchema.safeParse(request);
  if (!parsed.success) return null;
  const { festival: id, brief, venues, bands } = parsed.data;
  const demo = festivalById(id);
  const festival =
    demo ?? (brief && OWN_ID.test(id) ? yourFestival(brief, id) : null);
  if (!festival) return null;
  const own = festival.feeBands;
  if (
    bands.length !== own.length ||
    bands.some(
      (band, index) =>
        band.id !== own[index].id ||
        band.acts.length + band.open > own[index].slots,
    )
  )
    return null;
  const anyNew = bands.some((band) =>
    band.acts.some((act) => act.climb?.kind === "new"),
  );
  return {
    wordmark: SHARE_WORDMARK,
    tagline: drawable(`${TAGLINE_LEAD} ${TAGLINE_QLOO}`),
    stamp: demo ? PRINT_STAMP : stampWords(true),
    festival: drawable(festival.name),
    facts: drawable(factsLine(festival)),
    headliners: festival.headliners.map(drawable),
    drafted: SHARE_DRAFTED,
    from: drawable(draftedFrom(festival.city)),
    venues: venues
      .map((venue, index) => ({ venue, index }))
      .sort((a, b) => b.venue.acts - a.venue.acts || a.index - b.index)
      .map(({ venue }) => ({
        name: clip(drawable(signName(venue.name))),
        hue: venue.hue,
        acts: signChip({ lifted: venue.acts }),
      })),
    bands: bands.map((band) => ({
      id: band.id,
      name: PLAIN_BAND[band.id],
      open: band.open,
      acts: band.acts.map((act) => ({
        name: clip(drawable(act.name)),
        hue: act.hue,
        climb: markOf(act.place, act.climb),
      })),
    })),
    note: drawable(footnote(festival, anyNew)),
    file: posterFile(festival),
  };
}

/** A row of the poster as the page draws it (chart-rows.ts's billRows). */
interface PosterRow {
  kind: "act" | "listed" | "open";
  name: string;
  place: number | null;
  hue: number | null;
  act: Act | null;
}

/**
 * What the page sends to print the poster on screen: each band's acts in the poster's order,
 * leaving out an act marked unavailable (its slot prints open), and the venues on the key whose
 * fans lifted a printed act.
 */
export function printRequest({
  festival,
  brief,
  bands,
  venues,
  unavailable,
}: {
  festival: Pick<Festival, "id">;
  brief?: YourBrief;
  bands: readonly { band: { id: FeeBandId }; rows: readonly PosterRow[] }[];
  venues: readonly {
    entityId: string;
    name: string;
    hue: number | null;
    off: boolean;
  }[];
  unavailable: readonly string[];
}): PrintRequest {
  const lifted = new Map<string, number>();
  const printed = bands.map(({ band, rows }) => {
    const acts = rows.flatMap((row) =>
      row.kind === "act" && row.act && !unavailable.includes(row.act.entityId)
        ? [{ row, act: row.act }]
        : [],
    );
    for (const { act } of acts)
      lifted.set(
        act.anchorVenue.entityId,
        (lifted.get(act.anchorVenue.entityId) ?? 0) + 1,
      );
    return {
      id: band.id,
      open: rows.length - acts.length,
      acts: acts.map(({ row, act }) => {
        const lift = liftOf(act);
        return {
          name: row.name,
          hue: row.hue,
          place: row.place,
          climb: lift
            ? lift.kind === "new"
              ? ({ kind: "new" } as const)
              : ({ kind: "up", places: lift.places } as const)
            : null,
        };
      }),
    };
  });
  return {
    festival: festival.id,
    ...(brief ? { brief } : {}),
    venues: venues.flatMap((venue) =>
      !venue.off && venue.hue !== null && lifted.get(venue.entityId)
        ? [
            {
              name: venue.name,
              hue: venue.hue,
              acts: lifted.get(venue.entityId)!,
            },
          ]
        : [],
    ),
    bands: printed,
  };
}
