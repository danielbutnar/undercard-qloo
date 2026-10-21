import Link from "next/link";
import type { ReactNode } from "react";
import { TopBar } from "@/components/chart/top-bar";
import { evidenceHref } from "@/lib/method";
import "./chart/chart.css";

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
export function Ev({
  to,
  children,
}: {
  to: keyof typeof S;
  children: ReactNode;
}) {
  return (
    <a href={evidenceHref(S[to])} className="link">
      {children}
    </a>
  );
}

type Verdict = "shown" | "partly" | "not";
const VERDICT_WORDS: Record<Verdict, string> = {
  shown: "Shown",
  partly: "Partly shown",
  not: "Not shown",
};

/** A verdict as a mark: a full disc, a half disc or an empty ring. */
export function VerdictMark({ verdict }: { verdict: Verdict }) {
  return (
    <svg viewBox="0 0 24 24" className="verdict-mark" aria-hidden>
      <circle cx="12" cy="12" r="10" className="verdict-ring" />
      {verdict === "shown" && (
        <circle cx="12" cy="12" r="10" className="verdict-fill" />
      )}
      {verdict === "partly" && (
        <path d="M12 2a10 10 0 0 1 0 20z" className="verdict-fill" />
      )}
    </svg>
  );
}

function Objection({
  question,
  verdict,
  children,
}: {
  question: string;
  /** How far the answer goes, when it is a claim about the method. */
  verdict?: Verdict;
  children: ReactNode;
}) {
  return (
    <section aria-label={question} className="objection">
      <h3 className="objection-q">{question}</h3>
      {verdict && (
        <p className="verdict">
          <VerdictMark verdict={verdict} />
          {VERDICT_WORDS[verdict]}
        </p>
      )}
      <div className="objection-a">{children}</div>
    </section>
  );
}

/** What has and hasn't been shown, in three lines: on How it works and over the evidence. */
export function Verdicts() {
  return (
    <ul className="verdicts">
      <li>
        <VerdictMark verdict="shown" />
        <span>
          <strong>Shown:</strong> the AI agent drafts a full lineup from a
          town&apos;s own venues, through Qloo, in each of the 29 towns checked,
          and lists every Qloo call it makes.
        </span>
      </li>
      <li>
        <VerdictMark verdict="partly" />
        <span>
          <strong>Partly shown:</strong> that a town&apos;s venues point to the
          acts its festivals book. Treefort 2026 used two of the three Boise
          venues tested, and at ten real festivals the booked acts out-lifted
          matched random ones in 7, one short of the bar of 8.
        </span>
      </li>
      <li>
        <VerdictMark verdict="not" />
        <span>
          <strong>Not shown:</strong> that the town&apos;s crowd knows these
          acts, or that they would sell tickets, take the slot or fit a budget.
        </span>
      </li>
    </ul>
  );
}

type Row = {
  to: keyof typeof S;
  /** The premise tests ("Does the idea hold?") or the engineering checks ("Does the product work?"). */
  group: "idea" | "product";
  what: string;
  result: string;
  limit: string;
};

const ROWS: Row[] = [
  {
    to: "boise",
    group: "idea",
    what: "Does Boise's own festival book the venues Undercard reads?",
    result: "Treefort 2026 used two of the three Boise venues tested",
    limit: "Shows the venues are used, not that their fans predict bookings",
  },
  {
    to: "treefort",
    group: "idea",
    what: "Do Boise's venues pull Qloo's ranking toward Treefort's acts?",
    result: "No-go: 0 to 2 of 50 per list",
    limit: "Counts too small to show the signal either way",
  },
  {
    to: "premise",
    group: "idea",
    what: "On ten real festivals, do booked acts out-lift matched random ones?",
    result: "7 of 10, one short of the bar of 8",
    limit: "Partial lineups from Wikipedia; small differences",
  },
  {
    to: "local",
    group: "idea",
    what: "Does a town's crowd know the undercard acts?",
    result: "No-go: a usable local signal for 7 of 10 acts, bar 8",
    limit: "Not claimed",
  },
  {
    to: "runs",
    group: "product",
    what: "Is a build stable when run again?",
    result:
      "Every run filled both bands; three of four towns gave the same ten acts",
    limit: "Runs on one day, one pair of headliners",
  },
  {
    to: "ten",
    group: "product",
    what: "Does a judge's own US town fill both bands?",
    result: "Spike 8 of 10",
    limit: "Plain town names; corrected in section 12",
  },
  {
    to: "remeasure",
    group: "product",
    what: "Once towns resolve, do the ten US towns fill?",
    result: "8 of 10",
    limit: "A thin town is offered checked towns instead",
  },
  {
    to: "resolve",
    group: "product",
    what: "Does a town resolve to the right place?",
    result: "Go, with at most one extra call",
    limit: "Relies on Qloo's geocode",
  },
  {
    to: "checked",
    group: "product",
    what: "Do the 29 checked towns replay a full lineup?",
    result: "29 of 29",
    limit: "One fresh build each, on one day",
  },
  {
    to: "rooms",
    group: "product",
    what: "Can parks and arenas be filtered out?",
    result: "No-go; labelled instead",
    limit: "A festival site can still anchor a lineup",
  },
  {
    to: "festival",
    group: "product",
    what: "Can a festival filed as a place be told apart?",
    result: "Go: labelled, booking unchanged",
    limit: "The rule fits the one case seen",
  },
  {
    to: "order",
    group: "product",
    what: "Can Qloo score each pair's shared taste?",
    result: "180 of 180 pairs within 10 calls",
    limit: "A measure of taste, not of shared ticket buyers",
  },
  {
    to: "pairs",
    group: "product",
    what: "Does that score match a booker-style judgement?",
    result: "5 of 5 same-crowd pairs above every different-crowd pair",
    limit: "The pairs were Claude's judgement, not a working buyer's",
  },
  {
    to: "spread",
    group: "product",
    what: "Can a lineup spread across more venues?",
    result: "No-go: 0 of 4 towns",
    limit: "The venues that lift acts are already on the lineup",
  },
  {
    to: "retry",
    group: "product",
    what: "Does a build survive Qloo's rate limit?",
    result: "Retries with backoff inside a 45 s budget",
    limit: "A busy Qloo still ends a live run, with the replay offered",
  },
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const asNumber = (word: string) =>
  NUMBER_WORDS[word.toLowerCase()] ?? Number(word);

/**
 * A result as a picture only where its own words count something: one square per case,
 * filled for each that passed, with the bar marked when the test had one ("7 of 10, one short
 * of the bar of 8"); a count over 30 as a bar. A go or no-go chip only when the result says so;
 * a sourced fact or a description gets no picture, so nothing reads stronger than its row.
 */
function ResultPicture({ result }: { result: string }) {
  const count =
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten) of (?:the )?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.exec(
      result,
    );
  const bar = /bar(?: of)? (\d+)/.exec(result);
  if (!count) {
    if (/^No-go/.test(result))
      return (
        <span className="result-chip is-nogo" aria-hidden>
          no-go
        </span>
      );
    if (/^Go\b/.test(result))
      return (
        <span className="result-chip is-go" aria-hidden>
          go
        </span>
      );
    return null;
  }
  const hit = asNumber(count[1]);
  const of = asNumber(count[2]);
  if (!Number.isFinite(hit) || !Number.isFinite(of) || of === 0) return null;
  if (of > 30)
    return (
      <span className="result-bar" aria-hidden>
        <span style={{ width: `${Math.max(2, (hit / of) * 100)}%` }} />
      </span>
    );
  const mark = bar ? Number(bar[1]) : null;
  return (
    <span className="result-dots" aria-hidden>
      {Array.from({ length: of }, (_, i) => (
        <i
          key={i}
          className={`${i < hit ? "on" : ""} ${mark !== null && i === mark - 1 ? "bar" : ""}`}
        />
      ))}
    </span>
  );
}

/** One group of the evidence table: each row's question, result, limit and source. */
function EvidenceTable({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="evidence-group">
      <h3 className="evidence-title">{title}</h3>
      <div className="evidence-scroll">
        <table aria-label={title} className="evidence">
          <thead>
            <tr>
              <th>Question</th>
              <th>Result</th>
              <th>Limit</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.to}>
                <td>{row.what}</td>
                <td className="evidence-result">
                  <ResultPicture result={row.result} />
                  <span>{row.result}</span>
                </td>
                <td className="evidence-limit">{row.limit}</td>
                <td>
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
    </div>
  );
}

/**
 * The evidence (M10b moved it here from How it works, unchanged): what was tested, each result
 * drawn, with its limit and its source in docs/evidence.md; the five objections answered; and
 * what the numbers don't establish.
 */
export function MethodEvidencePage() {
  return (
    <div className="chart-app stage-bg">
      <TopBar method={false}>
        <Link href="/method">Back to How it works</Link>
      </TopBar>
      <main className="method">
        <div className="method-lead">
          <h1 className="compare-title">The evidence</h1>
          <p className="compare-what">
            Every test of the method, with its result, its limit and its source,
            and five objections answered.
          </p>
        </div>

        <div className="method-columns">
          <section aria-label="Evidence" className="panel">
            <h2 className="panel-title">What was tested</h2>
            <Verdicts />
            <EvidenceTable
              title="Does the idea hold?"
              rows={ROWS.filter((row) => row.group === "idea")}
            />
            <EvidenceTable
              title="Does the product work?"
              rows={ROWS.filter((row) => row.group === "product")}
            />
          </section>

          <div className="method-side">
            <section aria-label="Five objections" className="panel">
              <h2 className="panel-title">Five objections, answered</h2>
              <Objection
                question="Does the town know these acts?"
                verdict="not"
              >
                <p>
                  Not shown. Undercard measures that fans of the town&apos;s
                  venues like an act more than fans of the headliners alone: its
                  lift in Qloo&apos;s ranking. A direct measure of local
                  strength was a no-go (<Ev to="local">evidence 6</Ev>), and a
                  test on ten real festivals fell one short of its bar (
                  <Ev to="premise">evidence 18</Ev>).
                </p>
              </Objection>
              <Objection question="What does the AI model decide, and what does Qloo decide?">
                <p>
                  The AI agent (Claude) plans the Qloo calls: which venues to
                  read and in what order, within 12 calls. Qloo supplies every
                  ranking, affinity and popularity. The app&apos;s own rule
                  books the acts: a lift of 5 places or more, inside the fee
                  range, two genres shared with the headliners. The model
                  doesn&apos;t choose the acts (
                  <Ev to="decides">evidence 22</Ev>).
                </p>
              </Objection>
              <Objection question="Why venues?" verdict="partly">
                <p>
                  Qloo takes no location for artists, so a venue&apos;s fans are
                  how a town&apos;s taste gets into the ranking (
                  <Ev to="local">evidence 6</Ev>). And a town&apos;s festival
                  books its venues: Treefort 2026 used two of the three Boise
                  venues tested (<Ev to="boise">evidence 1</Ev>).
                </p>
              </Objection>
              <Objection question="What happens when a town is thin?">
                <p>
                  The town is resolved to its state or country first (
                  <Ev to="resolve">evidence 11</Ev>). With too few venues, the
                  page says so in one sentence and offers checked towns in the
                  same country; a band that can&apos;t fill keeps open slots,
                  never padded (<Ev to="decides">evidence 22</Ev>).
                </p>
              </Objection>
              <Objection question="Why trust a pick?" verdict="shown">
                <p>
                  Each act shows the venue whose fans lifted it, by how many
                  places, and its Qloo affinity and popularity. Every Qloo call
                  is in the trace, and a saved build replays call by call (
                  <Ev to="checked">evidence 13</Ev>,{" "}
                  <Ev to="climb">evidence 19</Ev>
                  ). The limits are stated below (
                  <Ev to="limits">what these numbers don&apos;t establish</Ev>
                  ).
                </p>
              </Objection>
            </section>

            <section
              aria-label="What these numbers don't establish"
              className="panel"
            >
              <h2 className="panel-title">
                What these numbers don&apos;t establish
              </h2>
              <ul className="limits">
                <li>
                  That the acts would sell tickets, take the slot or fit the
                  budget: the fee ranges are popularity ranges the buyer sets,
                  not fees.
                </li>
                <li>That a town&apos;s crowd knows the undercard acts.</li>
                <li>
                  That every venue behind a lineup is a club: a park or an arena
                  can still anchor one, and is labelled.
                </li>
                <li>
                  That a town&apos;s venues pick out what its festivals book:
                  the real-festival test fell one short.
                </li>
                <li>
                  Stability beyond the runs shown: a few runs per town, on one
                  day, with one pair of headliners.
                </li>
              </ul>
              <p className="mt-2 text-label">
                <Ev to="limits">The full list in docs/evidence.md</Ev>
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
