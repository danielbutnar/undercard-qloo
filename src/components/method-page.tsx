import Link from "next/link";
import type { ReactNode } from "react";
import { DEMO_VIDEO_URL, evidenceHref } from "@/lib/method";
import { VideoSlot } from "./video-slot";

// The bill's sheet (draft-bill.tsx's SHEET), copied: that module is a client component.
const SHEET =
  "relative flex flex-col border-2 border-rule bg-surface px-4 pt-5 pb-4 after:pointer-events-none after:absolute after:inset-1.5 after:border after:border-rule lg:px-9";

const S = {
  boise: "1. Why a club's crowd: Boise's own festival books Boise's rooms",
  treefort: "2. Check against a real Boise bill: no-go",
  towns: "3. Three more towns",
  runs: "5. The same brief, run again (M6b)",
  local: "6. Local strength from Qloo's location data: no-go (M6c)",
  ten: '7. Ten US towns, for "Your festival": go (M6f)',
  retry: "8. Riding out Qloo's rate limit (M6g)",
  rooms: "10. Rooms that are music rooms: no-go (M6i)",
  resolve: "11. Towns resolve to the right place: spike, go (M6j)",
  remeasure:
    "12. Re-measure of Your festival's towns (M6j), written before the runs",
  checked: "13. Checked towns replay (M6m), written before the builds",
  festival: "14. Festivals filed as places (M6o), written before the spike",
  order: "15. Running order (M8a), written before the spike",
  spread: "16. A bill that covers the town (M8b), written before the spike",
  pairs:
    "17. Does the running order's score match a booker's sense of a shared crowd? (M6r), written before scoring",
  premise:
    "18. Premise test on real festivals (M8d), written before the measurement",
  climb:
    "19. The lift, visible (M9a), written before the spike and the readers",
  compare:
    "20. Town against town (M9b), written before the spike and the reader",
  decides: "22. Who decides what, and what a thin town gets",
  limits: "What these numbers don't establish",
};

/** A claim's source: a link to its section of docs/evidence.md. */
function Ev({ to, children }: { to: keyof typeof S; children: ReactNode }) {
  return (
    <a
      href={evidenceHref(S[to])}
      className="text-accent underline underline-offset-2 hover:text-ink"
    >
      {children}
    </a>
  );
}

function Objection({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={question}
      className="flex flex-col gap-1 border-t border-rule pt-3"
    >
      <h3 className="text-body font-bold">{question}</h3>
      <div className="flex flex-col gap-1.5 text-body">{children}</div>
    </section>
  );
}

/** One diagram: headliners, the town's venues, the lift, the lineup. Text in the body face. */
function Diagram() {
  const box = "fill-[var(--color-page)] stroke-[var(--color-rule)]";
  const text = "fill-[var(--color-ink)] text-[17px]";
  const blue = "fill-[var(--color-accent)] text-[17px] font-semibold";
  return (
    <svg
      role="img"
      aria-label="How Undercard drafts a lineup: the headliners' fans give Qloo a ranked list of artists; adding the fans of one of the town's venues re-sorts it; an act that climbs 5 places or more is lifted; lifted acts in the fee range make the lineup."
      viewBox="0 0 960 250"
      className="h-auto w-full"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" className="fill-[var(--color-ink)]" />
        </marker>
      </defs>
      <rect
        x="10"
        y="20"
        width="210"
        height="90"
        rx="3"
        strokeWidth="2"
        className={box}
      />
      <text x="24" y="52" className={`${text} font-bold`}>
        The headliners
      </text>
      <text x="24" y="78" className={text}>
        Qloo ranks the artists
      </text>
      <text x="24" y="100" className={text}>
        their fans like
      </text>
      <rect
        x="10"
        y="140"
        width="210"
        height="90"
        rx="3"
        strokeWidth="2"
        className={box}
      />
      <text x="24" y="172" className={`${text} font-bold`}>
        The town&apos;s venues
      </text>
      <text x="24" y="198" className={text}>
        their fans are added
      </text>
      <text x="24" y="220" className={text}>
        one venue at a time
      </text>
      <line
        x1="220"
        y1="65"
        x2="300"
        y2="115"
        strokeWidth="2"
        markerEnd="url(#arrow)"
        className="stroke-[var(--color-ink)]"
      />
      <line
        x1="220"
        y1="185"
        x2="300"
        y2="135"
        strokeWidth="2"
        markerEnd="url(#arrow)"
        className="stroke-[var(--color-ink)]"
      />
      <rect
        x="305"
        y="80"
        width="250"
        height="90"
        rx="3"
        strokeWidth="2"
        className={box}
      />
      <text x="319" y="112" className={`${text} font-bold`}>
        The list re-sorts
      </text>
      <text x="319" y="138" className={blue}>
        +N, Venue 227
      </text>
      <text x="319" y="160" className={text}>
        places an act climbs
      </text>
      <line
        x1="555"
        y1="125"
        x2="625"
        y2="125"
        strokeWidth="2"
        markerEnd="url(#arrow)"
        className="stroke-[var(--color-ink)]"
      />
      <rect
        x="630"
        y="60"
        width="320"
        height="130"
        rx="3"
        strokeWidth="2"
        className={box}
      />
      <text x="644" y="92" className={`${text} font-bold`}>
        The lineup
      </text>
      <text x="644" y="118" className={text}>
        acts lifted 5 places or more,
      </text>
      <text x="644" y="140" className={text}>
        in the fee range, sharing two
      </text>
      <text x="644" y="162" className={text}>
        genres with the headliners
      </text>
    </svg>
  );
}

const ROWS: {
  to: keyof typeof S;
  what: string;
  result: string;
  limit: string;
}[] = [
  {
    to: "boise",
    what: "Does Boise's own festival book the venues Undercard reads?",
    result: "Treefort 2026 used two of the three Boise venues tested",
    limit: "Shows the venues are used, not that their fans predict bookings",
  },
  {
    to: "treefort",
    what: "Do Boise's venues pull Qloo's ranking toward Treefort's acts?",
    result: "No-go: 0 to 2 of 50 per list",
    limit: "Counts too small to show the signal either way",
  },
  {
    to: "premise",
    what: "On ten real festivals, do booked acts out-lift matched random ones?",
    result: "7 of 10, one short of the bar of 8",
    limit: "Partial lineups from Wikipedia; small differences",
  },
  {
    to: "local",
    what: "Does a town's crowd know the undercard acts?",
    result: "No-go: a usable local signal for 7 of 10 acts, bar 8",
    limit: "Not claimed",
  },
  {
    to: "runs",
    what: "Is a build stable when run again?",
    result:
      "Every run filled both bands; three of four towns gave the same ten acts",
    limit: "Runs on one day, one pair of headliners",
  },
  {
    to: "ten",
    what: "Does a judge's own US town fill both bands?",
    result: "Spike 8 of 10",
    limit: "Plain town names; corrected in section 12",
  },
  {
    to: "remeasure",
    what: "Once towns resolve, do the ten US towns fill?",
    result: "8 of 10",
    limit: "A thin town is offered checked towns instead",
  },
  {
    to: "resolve",
    what: "Does a town resolve to the right place?",
    result: "Go, with at most one extra call",
    limit: "Relies on Qloo's geocode",
  },
  {
    to: "checked",
    what: "Do the 29 checked towns replay a full lineup?",
    result: "29 of 29",
    limit: "One fresh build each, on one day",
  },
  {
    to: "rooms",
    what: "Can parks and arenas be filtered out?",
    result: "No-go; labelled instead",
    limit: "A festival site can still anchor a lineup",
  },
  {
    to: "festival",
    what: "Can a festival filed as a place be told apart?",
    result: "Go: labelled, booking unchanged",
    limit: "The rule fits the one case seen",
  },
  {
    to: "order",
    what: "Can Qloo score each pair's shared taste?",
    result: "180 of 180 pairs within 10 calls",
    limit: "A measure of taste, not of shared ticket buyers",
  },
  {
    to: "pairs",
    what: "Does that score match a booker-style judgement?",
    result: "5 of 5 same-crowd pairs above every different-crowd pair",
    limit: "The pairs were Claude's judgement, not a working buyer's",
  },
  {
    to: "spread",
    what: "Can a lineup spread across more venues?",
    result: "No-go: 0 of 4 towns",
    limit: "The venues that lift acts are already on the lineup",
  },
  {
    to: "retry",
    what: "Does a build survive Qloo's rate limit?",
    result: "Retries with backoff inside a 45 s budget",
    limit: "A busy Qloo still ends a live run, with the replay offered",
  },
];

/**
 * The method page (M9c), one click from the bill and in its language: one diagram, the five
 * objections answered with every claim linked to its row in docs/evidence.md, the evidence
 * table with its limits, and the demo video, loaded only when played.
 */
export function MethodPage({
  videoUrl = DEMO_VIDEO_URL,
}: { videoUrl?: string | null } = {}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b-2 border-rule px-4 py-3 lg:px-6">
        <h1 className="max-w-4xl text-body">
          <strong className="font-bold">Undercard</strong>, how it works: how
          the AI agent drafts a festival&apos;s smaller acts from what fans of
          the town&apos;s own venues like, and what has and hasn&apos;t been
          shown.
        </h1>
        <Link
          href="/"
          className="self-start text-label underline underline-offset-2 hover:text-accent"
        >
          Back to the lineup
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4 lg:px-6">
        <section aria-label="The method" className={SHEET}>
          <h2 className="text-figure font-bold">The method</h2>
          <Diagram />
          <p className="text-body">
            Qloo is a taste-data service that maps what fans of one artist,
            venue or film also like. Artists in Qloo take no location, so
            Undercard adds the fans of the town&apos;s own venues to the
            headliners&apos; and watches which acts climb.
          </p>
        </section>

        <section aria-label="Five objections" className={`${SHEET} gap-3`}>
          <h2 className="text-figure font-bold">Five objections, answered</h2>
          <Objection question="Does the town know these acts?">
            <p>
              Not shown. Undercard measures that fans of the town&apos;s venues
              like an act more than fans of the headliners alone: its lift in
              Qloo&apos;s ranking. A direct measure of local strength was a
              no-go (<Ev to="local">evidence 6</Ev>), and a test on ten real
              festivals fell one short of its bar (
              <Ev to="premise">evidence 18</Ev>).
            </p>
          </Objection>
          <Objection question="What does the AI model decide, and what does Qloo decide?">
            <p>
              The AI agent (Claude) plans the Qloo calls: which venues to read
              and in what order, within 12 calls. Qloo supplies every ranking,
              affinity and popularity. The app&apos;s own rule books the acts: a
              lift of 5 places or more, inside the fee range, two genres shared
              with the headliners. The model doesn&apos;t choose the acts (
              <Ev to="decides">evidence 22</Ev>).
            </p>
          </Objection>
          <Objection question="Why venues?">
            <p>
              Qloo takes no location for artists, so a venue&apos;s fans are how
              a town&apos;s taste gets into the ranking (
              <Ev to="local">evidence 6</Ev>). And a town&apos;s festival books
              its venues: Treefort 2026 used two of the three Boise venues
              tested (<Ev to="boise">evidence 1</Ev>).
            </p>
          </Objection>
          <Objection question="What happens when a town is thin?">
            <p>
              The town is resolved to its state or country first (
              <Ev to="resolve">evidence 11</Ev>). With too few venues, the page
              says so in one sentence and offers checked towns in the same
              country; a band that can&apos;t fill keeps open slots, never
              padded (<Ev to="decides">evidence 22</Ev>).
            </p>
          </Objection>
          <Objection question="Why trust a pick?">
            <p>
              Each act shows the venue whose fans lifted it, by how many places,
              and its Qloo affinity and popularity. Every Qloo call is in the
              trace, and a saved build replays call by call (
              <Ev to="checked">evidence 13</Ev>, <Ev to="climb">evidence 19</Ev>
              ). The limits are stated below (
              <Ev to="limits">what these numbers don&apos;t establish</Ev>
              ).
            </p>
          </Objection>
        </section>

        <section aria-label="Evidence" className={`${SHEET} gap-2`}>
          <h2 className="text-figure font-bold">What was tested</h2>
          <div className="w-full overflow-x-auto">
            <table
              aria-label="What was tested"
              className="w-full border-collapse text-left text-label"
            >
              <thead>
                <tr className="border-b-2 border-rule">
                  <th className="py-1 pr-3">Question</th>
                  <th className="py-1 pr-3">Result</th>
                  <th className="py-1 pr-3">Limit</th>
                  <th className="py-1">Source</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr
                    key={row.to}
                    className="border-b border-rule/50 align-top"
                  >
                    <td className="py-1.5 pr-3">{row.what}</td>
                    <td className="py-1.5 pr-3 font-semibold">{row.result}</td>
                    <td className="py-1.5 pr-3 text-muted">{row.limit}</td>
                    <td className="py-1.5">
                      <Ev to={row.to}>
                        {S[row.to].split(".")[0].match(/^\d+$/)
                          ? `evidence ${S[row.to].split(".")[0]}`
                          : "evidence"}
                      </Ev>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          aria-label="What these numbers don't establish"
          className={`${SHEET} gap-1`}
        >
          <h2 className="text-figure font-bold">
            What these numbers don&apos;t establish
          </h2>
          <ul className="list-disc pl-5 text-body">
            <li>
              That the acts would sell tickets, take the slot or fit the budget:
              the fee ranges are popularity ranges the buyer sets, not fees.
            </li>
            <li>That a town&apos;s crowd knows the undercard acts.</li>
            <li>
              That every venue behind a lineup is a club: a park or an arena can
              still anchor one, and is labelled.
            </li>
            <li>
              That a town&apos;s venues pick out what its festivals book: the
              real-festival test fell one short.
            </li>
            <li>
              Stability beyond the runs shown: a few runs per town, on one day,
              with one pair of headliners.
            </li>
          </ul>
          <p className="text-label">
            <Ev to="limits">The full list in docs/evidence.md</Ev>
          </p>
        </section>

        <section aria-label="The demo video" className={`${SHEET} gap-2`}>
          <h2 className="text-figure font-bold">The demo video</h2>
          <VideoSlot url={videoUrl} />
        </section>
      </main>
    </div>
  );
}
