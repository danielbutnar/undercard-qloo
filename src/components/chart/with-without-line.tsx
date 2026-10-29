import checks from "@/data/without-qloo-checks.json";
import counts from "@/data/with-without-2-0.json";

/**
 * How many acts the two lineups share, from the exact count (corrected 2026-10-22: the average,
 * 9.97, rounded to 10 had hidden Duluth's one shared act).
 */
export function sharedPhrase({
  sharedActs,
  townsSharingAnAct,
}: {
  sharedActs: number;
  townsSharingAnAct: number;
}): string {
  if (sharedActs === 0) return "the model alone and Qloo share no act";
  const acts = sharedActs === 1 ? "one act" : `${sharedActs} acts`;
  const towns =
    townsSharingAnAct === 1 ? "one town" : `${townsSharingAnAct} towns`;
  return `the model alone and Qloo share ${acts}, in ${towns}`;
}

/**
 * What the model alone and Qloo's lineups share, in one line, recounted on 2026-10-29 from the
 * 29 re-run builds of 28 October (Agent 2.0) beside the model's saved picks, matched by name
 * (src/data/with-without-2-0.json, which names its basis). Section 31's 1.0 record stays in
 * with-without-qloo.json; its "pass all three checks" was the 1.0 rule's and isn't said of the
 * 2.0 bills (Daniel, 29 Oct, 09:45).
 */
export function WithWithoutLine() {
  return (
    <p className="mode-number">
      Across {counts.towns} towns, {sharedPhrase(counts)}.
    </p>
  );
}

/**
 * The 2.0 re-runs in numbers, for How it works' method fold (Daniel, 29 Oct), from the same
 * record.
 */
export function RerunsLine() {
  const r = counts.reruns;
  return (
    <p className="mode-number">
      In the 2.0 re-runs of {r.date}: {r.acts} acts in {r.bills} full bills,
      from {r.callsMin} to {r.callsMax} Qloo calls a build; {r.twoVenueTowns}{" "}
      towns read two venues with fan data, and {r.oneVenueTown} one, the only
      one Qloo had fan data for there.
    </p>
  );
}

/**
 * Under the toggle (prompt-4): how the model's picks do on section 31's checks, each count on
 * its own base (Daniel's words, 2026-10-24): the range and genre counts and the three checks are
 * out of the picks Qloo found. The climb count isn't here: it counts any climb, not the rule's 5
 * places. Counts from docs/evidence.md section 31, which a cache-only run of
 * scripts/with-without-qloo.ts prints again; How it works keeps the line above.
 */
export function WithoutQlooChecksLine() {
  return (
    <p className="mode-number">
      Across {checks.towns} towns, the model alone picked {checks.picks} acts;
      Qloo found {checks.found} of them. Of those {checks.found},{" "}
      {checks.aboveRange} sit above the fee range, and {checks.twoGenres} share
      two genres with the headliners.
    </p>
  );
}
