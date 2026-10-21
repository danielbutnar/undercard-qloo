import type { FeeBandId } from "./fee-bands";
import type { FirstBill } from "./first-bill";
import type { Act } from "./lineup";
import { liftOf } from "./marks";

/**
 * The design round's lab (docs/design-bans.md C1-C4, TASKS.md "Design round"): six directions
 * behind /lab, on the saved Boise build. It opens only under `next dev` on this machine, never in
 * a production build or on Vercel, and its stills and clips stay in .design/lab (git-ignored).
 */
export function labEnabled(
  env: Partial<Record<string, string | undefined>> = process.env,
): boolean {
  return env.NODE_ENV === "development" && !env.VERCEL;
}

export interface LabDirection {
  slug: string;
  name: string;
  /** The concrete reference from the music world the direction is drawn from. */
  reference: string;
  /** One sentence on why it suits a festival talent buyer. */
  why: string;
}

export const LAB_DIRECTIONS: readonly LabDirection[] = [
  {
    slug: "chart",
    name: "The weekly chart",
    reference:
      "A printed weekly singles chart: this week's place, last week's, the climbers and the new entries",
    why: "A chart is where the music business already reads who is moving, and here every move is a Boise venue's crowd lifting an act, so the climb reads as booking evidence at a glance.",
  },
  {
    slug: "desk",
    name: "The mixing desk",
    reference:
      "A front-of-house console: one channel strip per input, named on console tape, solo to hear one alone",
    why: "It turns the buyer's question, whose crowd am I listening to, into a control, and shows the agent hearing each venue on its own before anything reaches the bill.",
  },
  {
    slug: "flap",
    name: "The split-flap board",
    reference:
      "A split-flap departures board: rows that flip letter by letter, a 'from' column and remarks",
    why: "A board of slots that fills row by row is a bill in progress, and its 'from' column names the venue each act comes from without a sentence of explanation.",
  },
  {
    slug: "marquee",
    name: "The club marquees",
    reference:
      "A music club's changeable-letter marquee: one for each Boise venue, the festival's on top",
    why: "It puts the town's own clubs, the source of every pick, on screen as places a buyer knows, so each act's reason is a sign over a club's door rather than a line of text.",
  },
  {
    slug: "board",
    name: "The booker's magnet board",
    reference:
      "A booking office's whiteboard: tiers drawn in marker, act names on magnet strips moved by hand",
    why: "It looks like what the bill is, a draft the buyer is still moving, and every strip carries the venue that put it there in the buyer's own marker.",
  },
  {
    slug: "tree",
    name: "The rock family tree",
    reference:
      "Pete Frame's Rock Family Trees: hand-lettered boxes and lines tracing who came from where",
    why: "It answers where an act came from as a line the buyer can follow, from the headliners through a Boise venue to the slot, which is the whole method on one screen.",
  },
];

export interface LabPlace {
  /** The act's place in Qloo's ranking for the headliners' fans alone; null when it wasn't in it. */
  was: number | null;
  /** Its place once its venue's fans were added; null when the build doesn't say. */
  now: number | null;
}

/** What a lab direction draws from the saved build: the first screen's bill and each act's places. */
export interface LabBill {
  first: FirstBill;
  places: Record<string, LabPlace>;
}

/**
 * Where each act stood before and after its venue's fans were added, from the saved build alone:
 * its band's headliners-only ranking and the lift its reason states (src/lib/marks.ts).
 */
export function labPlaces(
  acts: readonly Act[],
  baselines: Partial<Record<FeeBandId, readonly string[]>>,
): Record<string, LabPlace> {
  return Object.fromEntries(
    acts.map((act): [string, LabPlace] => {
      const lift = liftOf(act);
      if (lift?.kind === "new")
        return [act.entityId, { was: null, now: lift.top }];
      const rank = baselines[act.band]?.indexOf(act.entityId) ?? -1;
      if (!lift || rank < 0) return [act.entityId, { was: null, now: null }];
      return [act.entityId, { was: rank + 1, now: rank + 1 - lift.places }];
    }),
  );
}
