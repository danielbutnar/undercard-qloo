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
  premise2: "26. Premise test, round 2 (M8f), written before any run",
  withQloo: "31. With and Without Qloo, as a number, written before any call",
  people: "32. The test with real people, written before it runs",
  cheap: "33. Two cheap tests, written before any run",
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
          <strong>Shown:</strong> the agent drafted a full lineup from a
          town&apos;s own venues in 29 of 29 towns, and lists every Qloo call it
          made.
        </span>
      </li>
      <li>
        <VerdictMark verdict="partly" />
        <span>
          <strong>Partly shown:</strong> a town&apos;s venues point to the acts
          its festivals book. At 40 real festivals, the acts each festival
          booked showed more lift from the town&apos;s venues than band-matched
          random acts at 27: 7 of 10 in the first round, one short of its bar of
          8, and 20 of 30 in the second, the bar set beforehand. About half
          would be expected if the venues told us nothing. The differences are
          small. Treefort 2026 used two of the three Boise venues tested.
        </span>
      </li>
      <li>
        <VerdictMark verdict="not" />
        <span>
          <strong>Not shown:</strong> that the town&apos;s crowd knows these
          acts, or that they would sell tickets, take the slot or fit a budget.
          Undercard drafts a shortlist with its evidence attached; the buyer
          makes every call.
        </span>
      </li>
    </ul>
  );
}

type Row = {
  to: keyof typeof S;
  /** A second section the row's result comes from, when it has two. */
  also?: keyof typeof S;
  /** The premise tests ("Does the idea hold?") or the engineering checks ("Does the product work?"). */
  group: "idea" | "product";
  what: string;
  result: string;
  /** The bar, when the result's words don't say "bar of N" (the picture marks it). */
  bar?: number;
  /** Go or no-go, drawn as a chip where the result counts nothing; its words don't repeat it. */
  chip?: "go" | "no-go";
  limit: string;
};

// The rows, in the order and words of the review's section 9c with Daniel's corrections
// (plan.md item 10); every number is docs/evidence.md's.
const ROWS: Row[] = [
  {
    to: "premise2",
    group: "idea",
    what: "At 30 real festivals chosen before any run, did the acts they booked show more lift from the town's venues than band-matched random acts?",
    result:
      "20 of 30, the bar set beforehand; 20 of the 22 that could be scored",
    bar: 20,
    limit:
      "No margin. The 8 festivals with fewer than two acts in the fee ranges couldn't be scored and count against the bar. The differences are small, 0.003 to 0.059 in affinity. Most lineups don't name their headliners first. Research subagents gathered the lineups; 28 of 30 were checked against their pages.",
  },
  {
    to: "premise",
    group: "idea",
    what: "At 10 real festivals, did the acts they booked show more lift from the town's venues than band-matched random acts?",
    result: "7 of 10, one short of the bar of 8",
    limit:
      "Partial lineups from Wikipedia; small differences. The second round above used complete lineups because of this result.",
  },
  {
    to: "withQloo",
    group: "idea",
    what: "Without Qloo, do the model's own picks pass the tests every Qloo act passes?",
    result: "10 of 290 model picks pass all three; every Qloo act does",
    limit:
      "Qloo's own measures, which the model can't see. The two lineups share no act in any of the 29 towns.",
  },
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
    what: "Do Boise's venues pull Qloo's ranking toward Treefort's own acts?",
    result: "No-go: 0 to 2 of 50 acts per list",
    limit:
      "Too few acts to show the signal either way. One festival can't test the idea; the 40-festival rows above are the broader version of this check.",
  },
  {
    to: "local",
    group: "idea",
    what: "Can Qloo say directly whether a town's crowd knows an act?",
    result: "No-go: a usable local signal for 7 of 10 acts, bar 8",
    limit:
      "Not claimed anywhere in the product. Artists have no location of their own in Qloo, and its location data for them, tried three ways, gave a usable local reading for at most 7 of 10 acts, which is why venues are the route to a town's taste.",
  },
  {
    to: "checked",
    group: "product",
    what: "Filling a lineup. Does the agent draft a full lineup in every checked town?",
    result: "29 of 29",
    limit: "One fresh build each, on one day",
  },
  {
    to: "ten",
    also: "remeasure",
    group: "product",
    what: "Does a US town a judge might type fill both groups of slots?",
    result:
      "8 of 10, measured twice: first with plain town names, then with towns resolved to their state",
    limit:
      "The first run was corrected by the second. A thin town is offered checked towns instead.",
  },
  {
    to: "runs",
    also: "cheap",
    group: "product",
    what: "Does the same brief give the same lineup when run again?",
    result:
      "Every run filled both groups; three of four towns gave the same ten acts",
    limit:
      "On a second day, 3 of 4 towns gave their saved ten acts again; a second pair of headliners changed 6 of Boise's 10.",
  },
  {
    to: "resolve",
    group: "product",
    what: "Does a town name resolve to the right place?",
    result: "With at most one extra Qloo call",
    chip: "go",
    limit: "Relies on Qloo's geocode",
  },
  {
    to: "rooms",
    group: "product",
    what: "Reading venues. Can parks and arenas be kept out of the venue list?",
    result: "They are labelled instead",
    chip: "no-go",
    limit: "A festival site can still anchor a lineup, and the label says so",
  },
  {
    to: "festival",
    group: "product",
    what: "Can a festival filed as a place be told apart from a venue?",
    result: "Labelled, booking unchanged",
    chip: "go",
    limit: "The rule fits the one case seen",
  },
  {
    to: "spread",
    group: "product",
    what: "Can a lineup be spread across more of a town's venues?",
    result: "No-go: 0 of 4 towns",
    limit: "The venues that lift acts are already on the lineup",
  },
  {
    to: "order",
    group: "product",
    what: "Running order. Can Qloo score the shared taste of every pair of acts on the bill?",
    result: "180 of 180 pairs within 10 calls",
    limit: "A measure of taste, not of shared ticket buyers",
  },
  {
    to: "pairs",
    group: "product",
    what: "Does that score agree with a booker-style judgement of a shared crowd?",
    result: "5 of 5 same-crowd pairs scored above every different-crowd pair",
    limit: "The pairs were Claude's judgement, not a working buyer's",
  },
  {
    to: "retry",
    group: "product",
    what: "Live runs. Does a live build survive Qloo's rate limit?",
    result: "Retries with backoff inside a 45-second budget",
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
 * of the bar of 8"); a count over 30 as a bar. A go or no-go chip only where the row has one;
 * a sourced fact or a description gets no picture, so nothing reads stronger than its row.
 */
function ResultPicture({
  result,
  bar: given,
  chip,
}: {
  result: string;
  /** The bar, where the result's own words don't name it as "bar of N". */
  bar?: number;
  chip?: Row["chip"];
}) {
  const count =
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten) of (?:the )?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.exec(
      result,
    );
  const bar = /bar(?: of)? (\d+)/.exec(result);
  if (!count) {
    if (chip === "no-go")
      return (
        <span className="result-chip is-nogo" aria-hidden>
          no-go
        </span>
      );
    if (chip === "go")
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
  const mark = given ?? (bar ? Number(bar[1]) : null);
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

/** "evidence N" for a numbered section of docs/evidence.md, "evidence" otherwise. */
const label = (to: keyof typeof S) =>
  S[to].split(".")[0].match(/^\d+$/)
    ? `evidence ${S[to].split(".")[0]}`
    : "evidence";

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
                  <ResultPicture
                    result={row.result}
                    bar={row.bar}
                    chip={row.chip}
                  />
                  {/* The chip is hidden from a screen reader, so its word is said here once. */}
                  {row.chip && (
                    <span className="sr-only">
                      {row.chip === "go" ? "Go: " : "No-go: "}
                    </span>
                  )}
                  <span>{row.result}</span>
                </td>
                <td className="evidence-limit">{row.limit}</td>
                <td>
                  <Ev to={row.to}>{label(row.to)}</Ev>
                  {row.also && (
                    <>
                      , <Ev to={row.also}>{label(row.also)}</Ev>
                    </>
                  )}
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
 * The evidence (M10b moved it here from How it works; plan.md item 10 put it in the order and
 * words of the review's section 9c, with Daniel's corrections): the three summary lines, the
 * terms, each test with its result drawn, its limit and its source, what the no-gos taught, what
 * real people said (the testers' placeholder until they have), five objections answered, and
 * the limits.
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
            Every test below that has a bar had it written before it ran, except{" "}
            <Ev to="treefort">evidence 2</Ev>, whose bar the record doesn&apos;t
            date. The full record of each is in docs/evidence.md.
          </p>
        </div>

        <div className="method-columns">
          <section aria-label="Evidence" className="panel">
            <h2 className="panel-title">In fifteen seconds</h2>
            <Verdicts />
            <p className="mt-3 text-label">
              Five terms used below. A climb is how many places an act rises in
              Qloo&apos;s ranking when a venue&apos;s fans are added to the
              headliners&apos; fans. A lift, in the real-festival tests, is the
              most Qloo affinity an act gains from any one of the town&apos;s
              venues. Mid-size and opening are the two groups of slots, each
              with its own fee range. A fee range is a range of Qloo popularity
              the festival sets; in the demo, Sagebrush Sound&apos;s. It stands
              in for a fee because no fee data exists. Matched random acts are
              drawn at random from Qloo&apos;s ranking for the same headliners
              and matched on fee range, as docs/evidence.md describes.
            </p>
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
            <section aria-label="What the no-gos taught" className="panel">
              <h2 className="panel-title">What the no-gos taught</h2>
              <ul className="limits">
                <li>
                  Qloo&apos;s location data gave a usable local reading for at
                  most 7 of the 10 acts the venues picked (
                  <Ev to="local">evidence 6</Ev>), so a town&apos;s taste enters
                  the ranking through its venues&apos; fans; drafting from
                  Qloo&apos;s location signal itself wasn&apos;t tested.
                </li>
                <li>
                  One festival can&apos;t test the idea (
                  <Ev to="treefort">evidence 2</Ev>), so the test became 40
                  festivals with bars written first (
                  <Ev to="premise">evidence 18</Ev>,{" "}
                  <Ev to="premise2">evidence 26</Ev>).
                </li>
                <li>
                  Parks and arenas can&apos;t be filtered out (
                  <Ev to="rooms">evidence 10</Ev>), so they are labelled and the
                  buyer sees them.
                </li>
                <li>
                  Lineups can&apos;t be spread further (
                  <Ev to="spread">evidence 16</Ev>): the venues that lift acts
                  are already on the lineup.
                </li>
              </ul>
            </section>

            <section
              aria-label="What real people said, and what changed"
              className="panel"
            >
              <h2 className="panel-title">
                What real people said, and what changed
              </h2>
              <ul className="limits">
                <li>
                  The first person to see an early design couldn&apos;t tell
                  what it was for. The design was rebuilt; the current one is a
                  chart of climbing acts, each leading with its climb and the
                  venue behind it.
                </li>
                <li className="text-muted">
                  [Still to come: this week&apos;s test with real people,
                  against the bar written first (
                  <Ev to="people">evidence 32</Ev>): how many, what they said
                  within sixty seconds, and what changed.]
                </li>
              </ul>
            </section>

            <section aria-label="Five objections" className="panel">
              <h2 className="panel-title">Five objections, answered</h2>
              <Objection
                question="Does the town know these acts?"
                verdict="not"
              >
                <p>
                  Undercard measures that fans of the town&apos;s venues rank an
                  act higher than fans of the headliners alone: its climb. A
                  direct local measure was a no-go (
                  <Ev to="local">evidence 6</Ev>); the ten-festival test fell
                  one short of its bar (<Ev to="premise">evidence 18</Ev>) and
                  the thirty-festival test met it exactly (
                  <Ev to="premise2">evidence 26</Ev>). Both measure the
                  venues&apos; fans, not the town&apos;s crowd.
                </p>
              </Objection>
              <Objection
                question="What does the AI model decide, and what does Qloo decide?"
                verdict="shown"
              >
                <p>
                  In every replay: the agent (Claude) plans the Qloo calls:
                  which venues to read, in what order, within 12 calls. Qloo
                  supplies every ranking, affinity and popularity. The
                  app&apos;s own rule books the acts: a climb of 5 places or
                  more, inside the fee range, two genres shared with the
                  headliners. The model doesn&apos;t choose the acts (
                  <Ev to="decides">evidence 22</Ev>).
                </p>
              </Objection>
              <Objection question="Why venues?" verdict="partly">
                <p>
                  Artists have no location of their own in Qloo, and its
                  location data for them, tried three ways, gave a usable local
                  reading for at most 7 of 10 acts (
                  <Ev to="local">evidence 6</Ev>), so a venue&apos;s fans are
                  how a town&apos;s taste gets into the ranking. A town&apos;s
                  festival books its venues: Treefort 2026 used two of the three
                  Boise venues tested (<Ev to="boise">evidence 1</Ev>).
                </p>
              </Objection>
              <Objection
                question="What happens when a town is thin?"
                verdict="shown"
              >
                <p>
                  The town is resolved to its state or country first (
                  <Ev to="resolve">evidence 11</Ev>). With too few venues, the
                  page says so in one sentence and offers checked towns in the
                  same country; a group of slots that can&apos;t fill keeps open
                  slots, never padded (<Ev to="remeasure">evidence 12</Ev>,{" "}
                  <Ev to="decides">evidence 22</Ev>).
                </p>
              </Objection>
              <Objection question="Why trust a pick?" verdict="shown">
                <p>
                  Each act shows the venue whose fans lifted it, by how many
                  places, with its Qloo affinity and popularity. Every Qloo call
                  is in the trace, and a saved build replays call by call (
                  <Ev to="checked">evidence 13</Ev>,{" "}
                  <Ev to="climb">evidence 19</Ev>). The limits are below.
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
                  budget: the fee ranges are popularity ranges the festival
                  sets, not fees.
                </li>
                <li>
                  That a town&apos;s crowd knows the undercard acts, or that a
                  town&apos;s venues predict what its festivals book: the first
                  real-festival test fell one short, the second met its bar
                  exactly, with small differences, and both measure the
                  venues&apos; fans, not the town&apos;s crowd.
                </li>
                <li>
                  That every venue behind a lineup is a club: a park or an arena
                  can still anchor one, and is labelled.
                </li>
                <li>
                  Stability beyond the runs shown: a few runs per town over two
                  days, and one second pair of headliners in one town (
                  <Ev to="runs">evidence 5</Ev>, <Ev to="cheap">evidence 33</Ev>
                  ).
                </li>
                <li>
                  That the lineup includes local acts:{" "}
                  <Ev to="treefort">evidence 2</Ev> infers most sit below the
                  opening range&apos;s popularity floor, so Undercard drafts the
                  touring slots and leaves local ones to the buyer.
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
