"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ticketsSold, type PresaleDay } from "@/lib/festival";
import { formatCount, formatShortDate } from "@/lib/format";

const WIDTH = 320;
const HEIGHT = 72;
const INSET = 6; // keeps the 2px line and the end dot inside the box

/**
 * Daily presale as a single-series sparkline in black ink (blue is reserved for Qloo data).
 * Hover or arrow keys move a crosshair across the days; a hidden table carries every value.
 */
export function PresaleSparkline({
  presale,
  capacity,
}: {
  presale: readonly PresaleDay[];
  capacity: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const last = presale.length - 1;
  const shown = active ?? last;
  const peak = Math.max(...presale.map((day) => day.sold), 1);
  const x = (index: number) =>
    INSET + (index * (WIDTH - 2 * INSET)) / Math.max(last, 1);
  const y = (sold: number) =>
    HEIGHT - INSET - (sold / peak) * (HEIGHT - 2 * INSET);
  const points = presale.map(
    (day, index) => `${x(index).toFixed(1)},${y(day.sold).toFixed(1)}`,
  );
  const total = ticketsSold(presale);
  const first = presale[0];
  const day = presale[shown];

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - box.left) / box.width) * WIDTH;
    const index = Math.round(((viewX - INSET) / (WIDTH - 2 * INSET)) * last);
    setActive(Math.min(last, Math.max(0, index)));
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const moves: Record<string, number> = {
      ArrowLeft: shown - 1,
      ArrowRight: shown + 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    setActive(Math.min(last, Math.max(0, moves[event.key])));
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h2 id={titleId} className="text-label font-semibold">
        Presale, last 30 days
      </h2>
      <p className="text-body">
        <span className="text-figure font-semibold">{formatCount(total)}</span>{" "}
        sold of {formatCount(capacity)}
      </p>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Presale over the last 30 days: ${formatCount(total)} tickets sold of ${formatCount(capacity)}`}
        tabIndex={0}
        className="block h-auto w-full touch-none outline-offset-4 focus-visible:outline-2 focus-visible:outline-ink"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        {active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={0}
            y2={HEIGHT}
            stroke="var(--color-muted)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={x(shown)}
          cy={y(day.sold)}
          r={4}
          fill="var(--color-ink)"
          stroke="var(--color-page)"
          strokeWidth={2}
        />
      </svg>
      <div className="flex justify-between text-label text-muted">
        <span>{formatShortDate(first.date)}</span>
        <span aria-live="polite" className="font-semibold text-ink">
          {formatShortDate(day.date)}: {formatCount(day.sold)} sold
        </span>
        <span>{formatShortDate(presale[last].date)}</span>
      </div>
      <table className="sr-only">
        <caption>Presale by day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Tickets sold</th>
          </tr>
        </thead>
        <tbody>
          {presale.map((row) => (
            <tr key={row.date}>
              <td>{row.date}</td>
              <td>{row.sold}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
