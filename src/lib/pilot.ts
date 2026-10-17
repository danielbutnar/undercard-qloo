import type { FeeBandId } from "./fee-bands";
import type { Festival } from "./festival";
import { actsInBand, type Act } from "./lineup";
import { liftOf } from "./marks";
import { SAGEBRUSH_SOUND } from "./sagebrush";

/** A buyer's brief for a pilot draft: their town, two headliners and how many slots per band. */
export interface PilotBrief {
  city: string;
  region: string;
  headliners: readonly [string, string];
  slots: Record<FeeBandId, number>;
}

/** One line of the draft's call summary: a Qloo call, or one of the planner's own lines. */
export type PilotLogEntry =
  | {
      kind: "call";
      n: number;
      summary: string;
      endpoint: string;
      resultCount: number | null;
    }
  | { kind: "note"; text: string };

/** What an offline pilot run hands to the draft: no entity ids or scores reach the page. */
export interface PilotRun {
  festival: Festival;
  ranAt: string;
  acts: readonly Act[];
  roomsTested: Partial<Record<FeeBandId, readonly string[]>>;
  log: readonly PilotLogEntry[];
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * The demo's brief with the buyer's town, headliners and slots. The crowd's age and the fee
 * bands' popularity ranges stay the demo's: a pilot changes only what the buyer named.
 */
export function pilotFestival(brief: PilotBrief): Festival {
  return {
    ...SAGEBRUSH_SOUND,
    id: `pilot-${slug(brief.city)}`,
    name: `${brief.city} pilot`,
    city: brief.city,
    region: brief.region,
    headliners: [brief.headliners[0], brief.headliners[1]],
    feeBands: SAGEBRUSH_SOUND.feeBands.map((band) => ({
      ...band,
      slots: brief.slots[band.id],
    })),
    presale: [],
  };
}

const percentile = (value: number) => Math.round(value * 100);
const ordinal = (n: number) =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;

function liftWords(act: Act): string {
  const lift = liftOf(act);
  if (!lift) return "lifted";
  return lift.kind === "up"
    ? `+${lift.places} places`
    : `new (into the top ${lift.top})`;
}

/**
 * Calls the agent ran in parallel finish in any order; between two planner lines, they're
 * listed by call number.
 */
function inCallOrder(log: readonly PilotLogEntry[]): PilotLogEntry[] {
  const ordered: PilotLogEntry[] = [];
  let run: Extract<PilotLogEntry, { kind: "call" }>[] = [];
  const flush = () => {
    ordered.push(...run.sort((a, b) => a.n - b.n));
    run = [];
  };
  for (const entry of log) {
    if (entry.kind === "call") run.push(entry);
    else {
      flush();
      ordered.push(entry);
    }
  }
  flush();
  return ordered;
}

/** The one-page draft a buyer is sent, as Markdown. */
export function pilotDraft(run: PilotRun): string {
  const { festival } = run;
  const calls = run.log.filter((entry) => entry.kind === "call").length;
  const date = run.ranAt.slice(0, 10);
  const out: string[] = [
    `# Undercard draft for ${festival.city}, ${festival.region}`,
    "",
    `Drafted ${date} by Undercard's agent from ${calls} Qloo calls. A draft to react to, not a booking: the fee bands' popularity ranges stand in for fees, and nothing here checks an act's availability or forecasts ticket sales.`,
    "",
    "## The brief",
    "",
    `- Headliners booked: ${festival.headliners.join(" · ")}`,
    `- Crowd aged ${festival.crowdAge.min}–${festival.crowdAge.max}`,
    ...festival.feeBands.map(
      (band) =>
        `- ${band.label}: ${band.slots} slots, Qloo popularity ${ordinal(percentile(band.minPopularity))}–${ordinal(percentile(band.maxPopularity))} percentile`,
    ),
    "",
    "## The bill",
    "",
    `Each act is marked with the ${festival.city} venue whose crowd lifted it in Qloo's ranking, against the headliners' fans alone, and how far.`,
  ];
  for (const band of festival.feeBands) {
    const acts = actsInBand(run.acts, band.id);
    out.push(
      "",
      `### ${band.label}: ${acts.length} of ${band.slots} slots`,
      "",
    );
    for (const act of acts)
      out.push(`- **${act.name}**: ${act.anchorVenue.name}, ${liftWords(act)}`);
    for (let open = acts.length; open < band.slots; open++)
      out.push("- Open slot: no tested room lifted another act in this band.");
  }

  const rooms = new Map<string, FeeBandId[]>();
  for (const band of festival.feeBands)
    for (const room of run.roomsTested[band.id] ?? [])
      rooms.set(room, [...(rooms.get(room) ?? []), band.id]);
  out.push(
    "",
    "## The rooms tested",
    "",
    "| Room | Tested for | Acts lifted |",
    "|---|---|---|",
  );
  for (const [room, bands] of rooms) {
    const labels = festival.feeBands
      .filter((band) => bands.includes(band.id))
      .map((band) => band.label)
      .join(", ");
    const lifted = run.acts.filter(
      (act) => act.anchorVenue.name === room,
    ).length;
    out.push(`| ${room} | ${labels} | ${lifted} |`);
  }

  out.push("", `## How it was drafted: ${calls} Qloo calls`, "");
  for (const entry of inCallOrder(run.log)) {
    if (entry.kind === "note") out.push(`   Agent: ${entry.text}`);
    else
      out.push(
        `${entry.n}. ${entry.summary} (${entry.endpoint}): ${entry.resultCount ?? "no"} results`,
      );
  }
  out.push(
    "",
    "Two questions, if you have a minute: would a list like this help you fill an undercard, and what's missing?",
    "",
  );
  return out.join("\n");
}
