import { checksFor, CONTROL_LINE } from "./words";

/**
 * The three checks that put an act on a lineup (Daniel, 2026-10-29, WS18 item 1), numbered, in
 * the same words wherever they're listed: under the poster, on the door check and on How it
 * works. A 1.0 bill's first check is its climb alone (checksFor).
 */
export function ChecksList({
  local = true,
  className = "",
}: {
  /** The acts carry a local lift over a venue abroad (a 2.0 bill). */
  local?: boolean;
  className?: string;
}) {
  return (
    <ol aria-label="The three checks" className={`checks ${className}`.trim()}>
      {checksFor(local).map((check) => (
        <li key={check}>{check}</li>
      ))}
    </ol>
  );
}

/**
 * The poster's key under the acts: the three checks every act on it passed, the control's one
 * line where the venue abroad first appears (Daniel, 2026-10-29), and which act takes a slot.
 */
export function PosterChecks({
  local,
  quiet = false,
}: {
  local: boolean;
  quiet?: boolean;
}) {
  return (
    <div className={`poster-checks ${quiet ? "is-quiet" : ""}`.trim()}>
      <p className="poster-checks-title">Every act here passed three checks:</p>
      <ChecksList local={local} />
      {local && <p className="poster-checks-control">{CONTROL_LINE}</p>}
      <p className="poster-checks-rule">
        Of the acts that pass all three, the strongest Qloo match takes each
        slot.
      </p>
    </div>
  );
}
