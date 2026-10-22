import checks from "@/data/without-qloo-checks.json";
import counts from "@/data/with-without-qloo.json";

/**
 * What Qloo adds over the model alone, in one line from docs/evidence.md section 31's counts
 * (plan.md item 8): that the two lineups share no act and how many of the model's picks pass the
 * tests every Qloo act passes. The review's bar on distinct acts wasn't met, so nothing here
 * says Qloo's lineups answer more to the town.
 */
export function WithWithoutLine() {
  const shared =
    counts.averageChanged === 10
      ? "the model alone and Qloo share no act"
      : `Qloo changes ${counts.averageChanged} of the model's 10 acts on average`;
  return (
    <p className="mode-number">
      Across {counts.towns} towns, {shared}, and {counts.picksPassing} of the
      model&apos;s {counts.picks} picks pass the tests every Qloo act passes.
    </p>
  );
}

/**
 * Under the toggle (prompt-4): how the model's picks do on each of section 31's checks, the last
 * one only Qloo data can pass. Counts from docs/evidence.md section 31, which a cache-only run
 * of scripts/with-without-qloo.ts prints again; How it works keeps the line above.
 */
export function WithoutQlooChecksLine() {
  return (
    <p className="mode-number">
      Across {checks.towns} towns, {checks.twoGenres} of the model&apos;s{" "}
      {checks.picks} picks share two genres with the headliners,{" "}
      {checks.aboveRange} of the {checks.found} Qloo finds sit above the fee
      range, and {checks.climbs} climb with a town venue&apos;s fans, a check
      only Qloo data can pass.
    </p>
  );
}
