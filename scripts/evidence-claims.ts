// The site's numbers that `pnpm evidence:check` re-derives (scripts/evidence-check.ts). Each
// claim is a file, a phrase holding the number as the file has it (braces mark which number,
// when the phrase holds more than one) and the computation it must equal, or "not recomputable"
// with the reason: a number from a run that was never saved. Phrases and computations only: no
// act's name and no Qloo value, since the script reads those at run time. When a doc's wording
// changes, its phrase here changes with it, or the check says "not found".
import type { Claim, Computation } from "./evidence-check";

type Entry = Claim<Computation>;

const README = "README.md";
const STORY = "docs/devpost-story.md";
const EVIDENCE = "docs/evidence.md";
const AGGREGATE = "src/data/with-without-qloo.json";
const CHECKS = "src/data/without-qloo-checks.json";
const EVIDENCE_PAGE = "src/components/method-evidence.tsx";
const COMPARE = "src/lib/compare.ts";

const venue = (town: string, name: string): Computation => ({
  kind: "venue-acts",
  town,
  venue: name,
});
const calls = (town: string): Computation => ({ kind: "calls", town });
const filled = (town: string, band: "mid" | "opener"): Computation => ({
  kind: "filled",
  town,
  band,
});
const slots = (town: string, band: "mid" | "opener"): Computation => ({
  kind: "slots",
  town,
  band,
});
const shared = (town: string): Computation => ({
  kind: "shared-with-boise",
  town,
});
const without = (
  count: Extract<Computation, { kind: "without" }>["count"],
): Computation => ({ kind: "without", count });
const withQloo = (
  count: Extract<Computation, { kind: "with-qloo" }>["count"],
): Computation => ({ kind: "with-qloo", count });
const measure = (
  of: Extract<Computation, { kind: "measure" }>["of"],
): Computation => ({ kind: "measure", of });
const run = (of: Extract<Computation, { kind: "run" }>["of"]): Computation => ({
  kind: "run",
  of,
});
const rule = (
  of: Extract<Computation, { kind: "rule" }>["of"],
): Computation => ({
  kind: "rule",
  of,
});
const THREE_TOWNS = ["Austin", "Denver", "Nashville"];

const NOT = "not recomputable" as const;
const OFFLINE =
  "section 3's offline runs of 17 October (scripts/agent-offline.ts): no build was saved and their output wasn't kept";
const LOCAL =
  "section 6's location spike of 17 October: its measure isn't re-derived here (its raw output is .design/evidence/m6c-*)";
const SPIKE =
  "the M2 spike's first live calls of 15 October: only their counts were kept, in docs/qloo-spike.md";
const TREEFORT =
  "section 2's Treefort check of 17 October: its lists weren't saved";
const SOURCE = "a source (KIVI, 23 March 2026), not Undercard's data";
const RERUNS =
  "section 5's offline runs of 17 October: fresh memory caches, no build saved";
const CHEAP =
  "section 33's fresh runs of 21 October: a memory cache and no saved build (their counts sit in .design/cheap-tests/, not re-derived here)";

/** Section 20's lineups sharing acts with Boise's, of 10, town by town. */
const SHARED_WITH_BOISE: [town: string, phrase: string][] = [
  ["Austin", "Austin {3}, Denver"],
  ["Denver", "Denver {3}, Nashville"],
  ["Nashville", "Nashville {3}, Raleigh"],
  ["Raleigh", "Raleigh {0}, Chicago"],
  ["Chicago", "Chicago {1}, Seattle"],
  ["Seattle", "Seattle {2}, Minneapolis"],
  ["Minneapolis", "Minneapolis {3}, Duluth"],
  ["Duluth", "Duluth {4}, Kansas City"],
  ["Kansas City", "Kansas City {1}, Asheville"],
  ["Asheville", "Asheville {2}, Bozeman"],
  ["Bozeman", "Bozeman {3}, Burlington"],
  ["Burlington", "Burlington {4}, Calgary"],
  ["Calgary", "Calgary {2}, Toronto"],
  ["Toronto", "Toronto {0}, Montreal"],
  ["Montreal", "Montreal {3}, Reykjavík"],
  ["Reykjavík", "Reykjavík {3}, Oslo"],
  ["Oslo", "Oslo {4}, Aarhus"],
  ["Aarhus", "Aarhus {0}, Tallinn"],
  ["Tallinn", "Tallinn {2}, Berlin"],
  ["Berlin", "Berlin {1}, Hamburg"],
  ["Hamburg", "Hamburg {1}, Utrecht"],
  ["Utrecht", "Utrecht {1}, Rotterdam"],
  ["Rotterdam", "Rotterdam {1}, Paris"],
  ["Paris", "Paris {1}, Vienna"],
  ["Vienna", "Vienna {1}, Bucharest"],
  ["Bucharest", "Bucharest {4}, Cluj-Napoca"],
  ["Cluj-Napoca", "Cluj-Napoca {3}, Wrexham"],
  ["Wrexham", "Wrexham {3}. The first town"],
];

export const CLAIMS: readonly Entry[] = [
  // README.md: the demo festival, the bill, the rule and section 31's totals.
  { file: README, phrase: "Mid ({4} slots)", equals: slots("Boise", "mid") },
  {
    file: README,
    phrase: "Opener ({6} slots)",
    equals: slots("Boise", "opener"),
  },
  {
    file: README,
    phrase: "The headliners sit over {4} mid-size and 6 opening acts",
    equals: filled("Boise", "mid"),
  },
  {
    file: README,
    phrase: "The headliners sit over 4 mid-size and {6} opening acts",
    equals: filled("Boise", "opener"),
  },
  {
    file: README,
    phrase: "NEW when it entered the top {50})",
    equals: { kind: "baseline-top", town: "Boise" },
  },
  { file: README, phrase: "stops at {28}", equals: rule("call-cap") },
  {
    file: README,
    phrase: "at least {five} places above the headliners-only ranking",
    equals: rule("min-lift"),
  },
  { file: README, phrase: "in at most {3} calls", equals: rule("refill-cap") },
  {
    file: README,
    phrase: "at most {28} times per build",
    equals: rule("call-cap"),
  },
  {
    file: README,
    phrase:
      "a usable local reading for at most 7 of 10 acts, short of the bar of 8",
    equals: NOT,
    why: LOCAL,
  },
  {
    file: README,
    phrase:
      "Adding Venue 227 to the headliners moved N–29 artists per fee band up five or more places, and 22–23 of them share at least two genre tags with the headliners",
    equals: NOT,
    why: SPIKE,
  },
  {
    file: README,
    phrase: "Collective moved 26–31 (21–23 with shared tags)",
    equals: NOT,
    why: SPIKE,
  },
  {
    file: README,
    phrase: "refills its slot with at most {3} more Qloo calls",
    equals: rule("refill-cap"),
  },
  {
    file: README,
    phrase: "Measured over the {29} checked towns",
    equals: without("towns"),
  },
  {
    file: README,
    phrase: "of the model's {290} picks",
    equals: without("picks"),
  },
  { file: README, phrase: "{268} are on Qloo", equals: without("found") },
  {
    file: README,
    phrase: "{59} sit in the fee range",
    equals: without("inRange"),
  },
  {
    file: README,
    phrase: "({204} are bigger than its top)",
    equals: without("above"),
  },
  {
    file: README,
    phrase: "{235} share two genres with the headliners",
    equals: without("twoGenres"),
  },
  {
    file: README,
    phrase: "{11} climb with the fans of one of the town's venues",
    equals: without("climbs"),
  },
  {
    file: README,
    phrase: "and {10} pass all three tests",
    equals: without("allThree"),
  },
  {
    file: README,
    phrase: "measured With and Without Qloo across {29} towns",
    equals: without("towns"),
  },
  {
    file: README,
    phrase: "baseline answered {27} of them",
    equals: run("answers-asked"),
  },

  // docs/devpost-story.md: the rule, the current build and the three more towns. The Austin,
  // Denver and Nashville sentence is checked against those towns' saved builds.
  {
    file: STORY,
    phrase:
      "a usable local reading for at most 7 of 10 acts, short of the bar of 8",
    equals: NOT,
    why: LOCAL,
  },
  {
    file: STORY,
    phrase: "lifts it at least {five} places in Qloo's ranking",
    equals: rule("min-lift"),
  },
  {
    file: STORY,
    phrase: "the headliners over {4} Mid and 6 Opener acts",
    equals: filled("Boise", "mid"),
  },
  {
    file: STORY,
    phrase: "the headliners over 4 Mid and {6} Opener acts",
    equals: filled("Boise", "opener"),
  },
  {
    file: STORY,
    phrase: "in at most {three} Qloo calls",
    equals: rule("refill-cap"),
  },
  { file: STORY, phrase: "a build stops at {28}", equals: rule("call-cap") },
  {
    file: STORY,
    phrase: "an artist lifted {five} or more places",
    equals: rule("min-lift"),
  },
  {
    file: STORY,
    phrase:
      "adding Venue 227 to the headliners moved N–29 artists per fee band up five or more places, 22–23 of them sharing two genre tags",
    equals: NOT,
    why: SPIKE,
  },
  {
    file: STORY,
    phrase: "The Venue 418 moved N–31",
    equals: NOT,
    why: SPIKE,
  },
  {
    file: STORY,
    phrase: "{12} Qloo calls; both bands full",
    equals: calls("Boise"),
  },
  {
    file: STORY,
    phrase: "both bands full, {4} of 4",
    equals: filled("Boise", "mid"),
  },
  {
    file: STORY,
    phrase: "both bands full, 4 of {4}",
    equals: slots("Boise", "mid"),
  },
  {
    file: STORY,
    phrase: "4 of 4 and {6} of 6",
    equals: filled("Boise", "opener"),
  },
  {
    file: STORY,
    phrase: "4 of 4 and 6 of {6}",
    equals: slots("Boise", "opener"),
  },
  {
    file: STORY,
    phrase: "The Venue 418 lifted {8} acts",
    equals: venue("Boise", "Venue 418"),
  },
  {
    file: STORY,
    phrase: "Venue 227 {2} and Venue 166 Boise 0",
    equals: venue("Boise", "Venue 227"),
  },
  {
    file: STORY,
    phrase: "Venue 227 2 and Venue 166 Boise {0}",
    equals: venue("Boise", "Venue 166 Boise"),
  },
  {
    file: STORY,
    phrase: "Austin, Denver and Nashville within {12} Qloo calls",
    equals: { kind: "calls-across", towns: THREE_TOWNS, end: "most" },
  },
  {
    file: STORY,
    phrase: "Venue 213 Austin lifted all {10} acts",
    equals: venue("Austin", "Venue 213 Austin"),
  },
  {
    file: STORY,
    phrase: "Venue 420 and Venue 316 {0}",
    equals: venue("Austin", "Venue 316"),
  },
  {
    file: STORY,
    phrase: "Venue 420 and Venue 316 {0}",
    equals: venue("Austin", "Venue 420"),
  },
  {
    file: STORY,
    phrase: "Venue 333 and Venue 184 {5} each",
    equals: venue("Denver", "Venue 333"),
  },
  {
    file: STORY,
    phrase: "Venue 333 and Venue 184 {5} each",
    equals: venue("Denver", "Venue 184"),
  },
  {
    file: STORY,
    phrase: "Venue 331 {10}",
    equals: venue("Nashville", "Venue 331"),
  },
  {
    file: STORY,
    phrase: "Venue 106 and Venue 330 {0}",
    equals: venue("Nashville", "Venue 106"),
  },
  {
    file: STORY,
    phrase: "Venue 106 and Venue 330 {0}",
    equals: venue("Nashville", "Venue 330"),
  },
  {
    file: STORY,
    phrase: "{two} of the three rooms tested in Boise",
    equals: NOT,
    why: SOURCE,
  },
  {
    file: STORY,
    phrase: "two of the {three} rooms tested in Boise",
    equals: { kind: "venues-tested", town: "Boise" },
  },
  {
    file: STORY,
    phrase:
      "the best list held 2 of Treefort 2026's acts in the Mid band's top 50, against 1 for the headliners alone",
    equals: NOT,
    why: TREEFORT,
  },

  // docs/evidence.md section 3: the offline table can't be re-derived; production's builds can.
  {
    file: EVIDENCE,
    section: 3,
    phrase: "| Boise, Idaho | 8 |",
    equals: NOT,
    why: OFFLINE,
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase:
      "Venue 418 8, Venue 227 2, Venue 166 Boise 0 | yes, 4 + 6 | 12 |",
    equals: NOT,
    why: OFFLINE,
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "| Austin, Texas | 20 (the call's cap) |",
    equals: NOT,
    why: OFFLINE,
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase:
      "Venue 213 Austin 8, Venue 62 2, Venue 420 0 | yes, 4 + 6 | 12 |",
    equals: NOT,
    why: OFFLINE,
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "| Denver, Colorado | 20 (the call's cap) |",
    equals: NOT,
    why: OFFLINE,
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "Venue 333 5, Venue 184 5 | yes, 4 + 6 | 11 |",
    equals: NOT,
    why: OFFLINE,
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "| Nashville, Tennessee | 20 (the call's cap) |",
    equals: NOT,
    why: OFFLINE,
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase:
      "Venue 331 10, Venue 106 0, Venue 330 0 | yes, 4 + 6 | 12 |",
    equals: NOT,
    why: OFFLINE,
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "filled both bands within 12 Qloo calls",
    equals: NOT,
    why: OFFLINE,
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "in Denver the two rooms split them 5 and 5",
    equals: NOT,
    why: OFFLINE,
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "matched Boise's row above: Venue 418 {8}",
    equals: venue("Boise", "Venue 418"),
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "Venue 227 {2}, Venue 166 Boise 0, both bands full",
    equals: venue("Boise", "Venue 227"),
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "Venue 166 Boise {0}, both bands full",
    equals: venue("Boise", "Venue 166 Boise"),
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "both bands full in {12} calls",
    equals: calls("Boise"),
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "Austin: {12} calls",
    equals: calls("Austin"),
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "Venue 213 Austin lifted all {10} acts",
    equals: venue("Austin", "Venue 213 Austin"),
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "Denver: {11} calls",
    equals: calls("Denver"),
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "Venue 333 {5} and Venue 184 5",
    equals: venue("Denver", "Venue 333"),
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "Venue 333 5 and Venue 184 {5}",
    equals: venue("Denver", "Venue 184"),
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "Nashville: {12} calls",
    equals: calls("Nashville"),
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "Venue 331 lifted all {10}",
    equals: venue("Nashville", "Venue 331"),
  },
  {
    file: EVIDENCE,
    section: 3,
    phrase: "{No} call was refused",
    equals: { kind: "refused-calls", towns: THREE_TOWNS },
  },

  // Section 5's reruns, as the evidence page words them.
  {
    file: EVIDENCE_PAGE,
    phrase:
      "Every run filled both groups; three of four towns gave the same ten acts",
    equals: NOT,
    why: RERUNS,
  },

  // docs/evidence.md section 13: every slot filled in the 25 later builds and in all 29.
  {
    file: EVIDENCE,
    section: 13,
    phrase: "All {25} filled both bands",
    equals: { kind: "full-lineups", towns: "later" },
  },
  {
    file: EVIDENCE,
    section: 13,
    phrase: "with {11} or 12 Qloo calls each",
    equals: { kind: "calls-across", towns: "later", end: "fewest" },
  },
  {
    file: EVIDENCE,
    section: 13,
    phrase: "with 11 or {12} Qloo calls each",
    equals: { kind: "calls-across", towns: "later", end: "most" },
  },
  {
    file: EVIDENCE,
    section: 13,
    phrase: "and {no} call retried",
    equals: { kind: "refused-calls", towns: "later" },
  },
  {
    file: EVIDENCE,
    section: 13,
    phrase: "No town leaves the list: {29} of 29 stay",
    equals: { kind: "full-lineups", towns: "all" },
  },
  {
    file: EVIDENCE,
    section: 13,
    phrase: "{28} of the 29 are those of 17 October",
    equals: { kind: "built-on", date: "2026-10-17", towns: "all" },
  },

  // docs/evidence.md section 19: the climb, rebuilt from the cache in every replay.
  {
    file: EVIDENCE,
    section: 19,
    phrase: "all {29} saved builds rebuilt their full climb",
    equals: { kind: "climb-rebuilt", of: "towns" },
  },
  {
    file: EVIDENCE,
    section: 19,
    phrase: "({4} to 7 lists each",
    equals: { kind: "climb-rebuilt", of: "fewest-lists" },
  },
  {
    file: EVIDENCE,
    section: 19,
    phrase: "(4 to {7} lists each",
    equals: { kind: "climb-rebuilt", of: "most-lists" },
  },

  // docs/evidence.md section 20 and src/lib/compare.ts: each town against Boise's lineup.
  ...SHARED_WITH_BOISE.map(([town, phrase]): Entry => ({
    file: EVIDENCE,
    section: 20,
    phrase,
    equals: shared(town),
  })),
  {
    file: EVIDENCE,
    section: 20,
    phrase: "Austin ({3} shared, 7 its own)",
    equals: shared("Austin"),
  },
  {
    file: EVIDENCE,
    section: 20,
    phrase: "Austin (3 shared, {7} its own)",
    equals: { kind: "own-vs-boise", town: "Austin" },
  },
  {
    file: EVIDENCE,
    section: 20,
    phrase: "so only {3} of 10 acts are on both",
    equals: shared("Austin"),
  },
  {
    file: COMPARE,
    phrase: "Austin, {3} shared and 7 its own",
    equals: shared("Austin"),
  },
  {
    file: COMPARE,
    phrase: "Austin, 3 shared and {7} its own",
    equals: { kind: "own-vs-boise", town: "Austin" },
  },

  // docs/evidence.md section 31: With and Without Qloo, as a number.
  {
    file: EVIDENCE,
    section: 31,
    phrase: "For each of the {29} checked towns",
    equals: { kind: "checked-towns" },
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "{Two} of the 29 have a saved answer",
    equals: run("answers-saved"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "the {55}th to 92nd percentile",
    equals: { kind: "fee-range", end: "bottom" },
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "the 55th to {92}nd percentile",
    equals: { kind: "fee-range", end: "top" },
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "the claim holds ({10} of 290 picks pass all three",
    equals: without("allThree"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "(10 of {290} picks pass all three",
    equals: without("picks"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "{27} model calls, one per festival without a saved answer",
    equals: run("model-calls"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "and {110} Qloo searches with no retry",
    equals: run("searches"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "Qloo searches with {no} retry",
    equals: run("search-retries"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "All {29} builds' lists were read from the cache",
    equals: without("rebuilt"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| Acts | {290} | 290 |",
    equals: without("picks"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| Acts | 290 | {290} |",
    equals: withQloo("acts"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| Found on Qloo | {268} | 290 |",
    equals: without("found"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| Found on Qloo | 268 | {290} |",
    equals: withQloo("found"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| In the fee range | {59} | 290 |",
    equals: without("inRange"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| In the fee range | 59 | {290} |",
    equals: withQloo("inRange"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| Two genres shared with the headliners | {235} | 290 |",
    equals: without("twoGenres"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| Two genres shared with the headliners | 235 | {290} |",
    equals: withQloo("twoGenres"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| A climb with one of the town's venues' fans | {11} | 290 |",
    equals: without("climbs"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| A climb with one of the town's venues' fans | 11 | {290} |",
    equals: withQloo("climbs"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| All three | {10} | 290 |",
    equals: without("allThree"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "| All three | 10 | {290} |",
    equals: withQloo("allThree"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "{235} of its 290 picks share two genres with them",
    equals: without("twoGenres"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "of the {268} picks Qloo finds",
    equals: without("found"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "{204} sit above the fee range's top",
    equals: without("above"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "{5} below its bottom",
    equals: without("below"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "and {59} inside it",
    equals: without("inRange"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "{11} of its picks climb with the fans",
    equals: without("climbs"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase:
      "At {20} of the 29 festivals none of its ten picks passes all three tests",
    equals: { kind: "without-towns", count: "allThree", equal: 0 },
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "and at none do more than {two}",
    equals: { kind: "without-most", count: "allThree" },
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "the run above made {110} distinct Qloo searches",
    equals: run("searches"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "Qloo changes all 10 acts in {28} of the 29 towns",
    equals: measure("towns-sharing-no-act"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "is met, {29} of 29",
    equals: measure("towns-changed-seven"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "The 29 With Qloo lineups hold {85} distinct acts",
    equals: measure("distinct-with"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "the 29 Without Qloo lineups hold {110}",
    equals: measure("distinct-without"),
  },
  {
    file: EVIDENCE,
    section: 31,
    phrase: "(iii) {3} acts appear in half or more",
    equals: measure("named-in-half"),
  },

  // docs/evidence.md section 33: two fresh runs that saved nothing.
  {
    file: EVIDENCE,
    section: 33,
    phrase:
      "Fleet Foxes and Bon Iver fell outside the window; 4 searches in all",
    equals: NOT,
    why: CHEAP,
  },
  {
    file: EVIDENCE,
    section: 33,
    phrase:
      "Boise, Austin and Nashville gave the same ten acts as their saved builds of 17 October",
    equals: NOT,
    why: CHEAP,
  },
  {
    file: EVIDENCE,
    section: 33,
    phrase: "Denver gave 7 of its 10, with 3 others",
    equals: NOT,
    why: CHEAP,
  },
  {
    file: EVIDENCE,
    section: 33,
    phrase: "So 3 of 4, the bar",
    equals: NOT,
    why: CHEAP,
  },
  {
    file: EVIDENCE,
    section: 33,
    phrase: "47 Qloo calls, no call refused, one run each",
    equals: NOT,
    why: CHEAP,
  },
  {
    file: EVIDENCE,
    section: 33,
    phrase:
      "6 of the 10 acts differ from the Khruangbin and Japanese Breakfast draft",
    equals: NOT,
    why: CHEAP,
  },
  {
    file: EVIDENCE,
    section: 33,
    phrase: "12 Qloo calls for the run and 4 searches to choose the pair",
    equals: NOT,
    why: CHEAP,
  },
  {
    file: EVIDENCE,
    section: 33,
    phrase: "The other 4 acts are on both lineups",
    equals: NOT,
    why: CHEAP,
  },
  {
    file: EVIDENCE_PAGE,
    phrase:
      "On a second day, 3 of 4 towns gave their saved ten acts again; a second pair of headliners changed 6 of Boise's 10.",
    equals: NOT,
    why: CHEAP,
  },

  // The copy constants: the toggle's lines and the evidence page.
  { file: AGGREGATE, phrase: '"towns": {29}', equals: without("towns") },
  {
    file: AGGREGATE,
    phrase: '"averageChanged": {9.97}',
    equals: measure("average-changed"),
  },
  {
    file: AGGREGATE,
    phrase: '"sharedActs": {1}',
    equals: measure("shared-acts"),
  },
  {
    file: AGGREGATE,
    phrase: '"townsSharingAnAct": {1}',
    equals: measure("towns-sharing-an-act"),
  },
  {
    file: AGGREGATE,
    phrase: '"townsChangedSeven": {29}',
    equals: measure("towns-changed-seven"),
  },
  {
    file: AGGREGATE,
    phrase: '"distinctWith": {85}',
    equals: measure("distinct-with"),
  },
  {
    file: AGGREGATE,
    phrase: '"distinctWithout": {110}',
    equals: measure("distinct-without"),
  },
  {
    file: AGGREGATE,
    phrase: '"inHalfOrMoreWithout": {3}',
    equals: measure("named-in-half"),
  },
  { file: AGGREGATE, phrase: '"picks": {290}', equals: without("picks") },
  {
    file: AGGREGATE,
    phrase: '"picksPassing": {10}',
    equals: without("allThree"),
  },
  { file: CHECKS, phrase: '"towns": {29}', equals: without("towns") },
  { file: CHECKS, phrase: '"picks": {290}', equals: without("picks") },
  { file: CHECKS, phrase: '"found": {268}', equals: without("found") },
  { file: CHECKS, phrase: '"inRange": {59}', equals: without("inRange") },
  { file: CHECKS, phrase: '"aboveRange": {204}', equals: without("above") },
  { file: CHECKS, phrase: '"belowRange": {5}', equals: without("below") },
  { file: CHECKS, phrase: '"twoGenres": {235}', equals: without("twoGenres") },
  { file: CHECKS, phrase: '"climbs": {11}', equals: without("climbs") },
  { file: CHECKS, phrase: '"allThree": {10}', equals: without("allThree") },
  {
    file: EVIDENCE_PAGE,
    phrase: "own venues in {29} of 29 towns",
    equals: { kind: "full-lineups", towns: "all" },
  },
  {
    file: EVIDENCE_PAGE,
    phrase: "{10} of 290 model picks pass all three; every Qloo act does",
    equals: without("allThree"),
  },
  {
    file: EVIDENCE_PAGE,
    phrase: "10 of {290} model picks pass all three",
    equals: without("picks"),
  },
  {
    file: EVIDENCE_PAGE,
    phrase: "The two lineups share no act in {28} of the 29 towns",
    equals: measure("towns-sharing-no-act"),
  },
  {
    file: EVIDENCE_PAGE,
    phrase: 'result: "{29} of 29"',
    equals: { kind: "full-lineups", towns: "all" },
  },
];
