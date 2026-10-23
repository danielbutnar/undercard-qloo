import checks from "@/data/without-qloo-checks.json";
import counts from "@/data/with-without-qloo.json";

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
 * What Qloo adds over the model alone, in one line from docs/evidence.md section 31's counts
 * (plan.md item 8): how many acts the two lineups share and how many of the model's picks pass
 * the tests every Qloo act passes. The review's bar on distinct acts wasn't met, so nothing here
 * says Qloo's lineups answer more to the town.
 */
export function WithWithoutLine() {
  return (
    <p className="mode-number">
      Across {counts.towns} towns, {sharedPhrase(counts)}, and{" "}
      {counts.picksPassing} of the model&apos;s {counts.picks} picks pass all
      three checks.
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
      {checks.aboveRange} sit above the fee range, {checks.twoGenres} share two
      genres with the headliners, and {checks.allThree} pass all three of the
      rule&apos;s checks.
    </p>
  );
}
