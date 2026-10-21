import { MIN_LIFT } from "@/lib/assemble-lineup";

/**
 * How an act gets on: the booking rule (src/lib/assemble-lineup.ts) as three pictures that add
 * up, instead of a paragraph. Qloo supplies every number; the app's own rule books the act.
 */
export function RuleKey() {
  return (
    <section aria-labelledby="rule-title" className="panel">
      <h2 id="rule-title" className="panel-title">
        How an act gets on
      </h2>
      <ul className="rule">
        <li>
          <svg viewBox="0 0 120 34" aria-hidden>
            <rect x="2" y="13" width="78" height="8" className="fill-ink" />
            <polygon points="78,3 118,17 78,31" className="fill-ink" />
          </svg>
          It climbs {MIN_LIFT} places or more with a venue&apos;s fans
        </li>
        <li>
          <svg viewBox="0 0 120 34" aria-hidden>
            <rect x="2" y="13" width="116" height="8" className="fill-quiet" />
            <rect
              x="70"
              y="5"
              width="30"
              height="24"
              className="fill-surface stroke-ink"
              strokeWidth="3"
            />
            <circle cx="86" cy="17" r="5" className="fill-ink" />
          </svg>
          It sits in the fee range
        </li>
        <li>
          <svg viewBox="0 0 120 34" aria-hidden>
            <rect x="4" y="5" width="48" height="24" className="fill-ink" />
            <rect
              x="68"
              y="5"
              width="48"
              height="24"
              className="fill-accent stroke-ink"
              strokeWidth="3"
            />
            <path d="M54 17h12" className="stroke-ink" strokeWidth="4" />
          </svg>
          It shares two genres with the headliners
        </li>
      </ul>
      <p className="rule-sum">
        <span className="check" aria-hidden>
          <svg viewBox="0 0 20 20" width="16" height="16">
            <path
              d="M4 10.5l4 4L16 6"
              fill="none"
              className="stroke-ink"
              strokeWidth="3"
            />
          </svg>
        </span>
        On the lineup, strongest Qloo affinity first. Qloo supplies the numbers;
        the AI agent picks which venues to read.
      </p>
    </section>
  );
}
