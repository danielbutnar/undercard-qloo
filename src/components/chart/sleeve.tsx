"use client";

import { useId, type ReactNode } from "react";
import { hashOf, sleeveFor, sleeveWords, type SleeveForm } from "@/lib/sleeve";

// Each form fills a 100x100 box in currentColor; the sleeve clips it to its half.
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const FORMS: Record<SleeveForm, ReactNode> = {
  rings: (
    <g fill="none" stroke="currentColor">
      {range(6).map((i) => (
        <circle
          key={i}
          cx="30"
          cy="30"
          r={7 + i * 12}
          strokeWidth={7 - i * 0.5}
          opacity={1 - i * 0.13}
        />
      ))}
    </g>
  ),
  fade: (
    <g fill="currentColor">
      {range(7).map((i) => (
        <rect
          key={i}
          x="-10"
          y={i * 15}
          width="120"
          height={11 - i}
          opacity={1 - i * 0.12}
        />
      ))}
    </g>
  ),
  spiral: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      d={range(90)
        .map((i) => {
          const angle = i * 0.32;
          const radius = 2 + i * 0.75;
          const x = 50 + radius * Math.cos(angle);
          const y = 50 + radius * Math.sin(angle);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ")}
    />
  ),
  stipple: (
    <g fill="currentColor">
      {range(64).map((i) => {
        const x = (i % 8) * 13 + 5 + ((i * 37) % 7) - 3;
        const y = Math.floor(i / 8) * 13 + 5 + ((i * 53) % 7) - 3;
        return <circle key={i} cx={x} cy={y} r={1.6 + ((i * 29) % 5) * 0.55} />;
      })}
    </g>
  ),
  waves: (
    <g fill="none" stroke="currentColor" strokeWidth="6">
      {range(6).map((i) => (
        <path
          key={i}
          d={`M-10 ${8 + i * 17} q 15 -12 30 0 t 30 0 t 30 0 t 30 0`}
        />
      ))}
    </g>
  ),
  arcs: (
    <g fill="none" stroke="currentColor" strokeWidth="8">
      <circle cx="0" cy="0" r="13" fill="currentColor" stroke="none" />
      {range(5).map((i) => (
        <circle key={i} cx="0" cy="0" r={27 + i * 14} />
      ))}
    </g>
  ),
  staff: (
    <g fill="currentColor">
      {range(2).map((block) =>
        range(5).map((line) => (
          <rect
            key={`${block}-${line}`}
            x="-5"
            y={10 + block * 48 + line * 7}
            width="110"
            height="2.6"
          />
        )),
      )}
      <circle cx="28" cy="20" r="6" />
      <circle cx="58" cy="27" r="6" />
      <circle cx="40" cy="68" r="6" />
      <circle cx="78" cy="61" r="6" />
    </g>
  ),
  shards: (
    <g fill="currentColor">
      <polygon points="6,8 46,14 18,48" />
      <polygon points="54,4 92,30 60,40" />
      <polygon points="10,60 40,52 30,94" />
      <polygon points="58,56 96,62 70,96" opacity="0.7" />
    </g>
  ),
  blocks: (
    <g>
      <rect x="8" y="8" width="30" height="30" fill="currentColor" />
      <rect
        x="25"
        y="25"
        width="31"
        height="31"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
      />
      <rect x="62" y="58" width="22" height="22" fill="currentColor" />
    </g>
  ),
  bars: (
    <g fill="currentColor">
      {[
        [4, 7],
        [18, 15],
        [40, 5],
        [53, 19],
        [79, 8],
        [93, 5],
      ].map(([x, width]) => (
        <rect key={x} x={x} y="0" width={width} height="100" />
      ))}
    </g>
  ),
  stripes: (
    <g fill="currentColor" transform="rotate(45 50 50)">
      {range(8).map((i) => (
        <rect key={i} x="-60" y={-34 + i * 26} width="220" height="13" />
      ))}
    </g>
  ),
  dots: (
    <g fill="currentColor">
      <circle cx="31" cy="33" r="25" />
      <circle cx="68" cy="17" r="12" />
      <circle cx="17" cy="71" r="10" />
      <circle cx="62" cy="52" r="8" />
    </g>
  ),
  crosses: (
    <g stroke="currentColor" strokeWidth="5.5" fill="none">
      {range(16).map((i) => {
        const x = 14 + (i % 4) * 24;
        const y = 14 + Math.floor(i / 4) * 24;
        return <path key={i} d={`M${x} ${y - 6}v12M${x - 6} ${y}h12`} />;
      })}
    </g>
  ),
  chevrons: (
    <g fill="none" stroke="currentColor" strokeWidth="7">
      {range(5).map((i) => (
        <path key={i} d={`M-5 ${i * 22 - 4} l55 18 l55 -18`} />
      ))}
    </g>
  ),
  bricks: (
    <g fill="currentColor">
      {range(6).map((row) =>
        range(4).map((col) => (
          <rect
            key={`${row}-${col}`}
            x={col * 28 - (row % 2) * 14}
            y={row * 17}
            width="24"
            height="13"
          />
        )),
      )}
    </g>
  ),
  grid: (
    <g fill="currentColor">
      {range(25).map((i) => (
        <rect
          key={i}
          x={4 + (i % 5) * 20}
          y={4 + Math.floor(i / 5) * 20}
          width={i % 3 === 0 ? 12 : 7}
          height={i % 3 === 0 ? 12 : 7}
        />
      ))}
    </g>
  ),
};

/**
 * An act's sleeve (src/lib/sleeve.ts): the first genre's form in the top-left half in the
 * venue's colour, the second's in the bottom-right half on the venue's colour. Colours come
 * from the theme (--color-venue-N through the row's venue class), so the sleeve follows its
 * venue when the lineup re-forms.
 */
export function Sleeve({
  genres,
  id,
  className = "",
  label = true,
}: {
  genres: readonly string[];
  /** The act's id: it only turns and mirrors the forms. */
  id: string;
  className?: string;
  /** False when the row already says the genres, so the picture isn't read twice. */
  label?: boolean;
}) {
  const clip = useId().replace(/:/g, "");
  const spec = sleeveFor(genres, id);
  return (
    <svg
      viewBox="0 0 100 100"
      className={`sleeve ${className}`}
      {...(label
        ? { role: "img", "aria-label": sleeveWords(genres) }
        : { "aria-hidden": true })}
    >
      <defs>
        <clipPath id={`${clip}-a`}>
          <polygon points="0,0 100,0 0,100" />
        </clipPath>
        <clipPath id={`${clip}-b`}>
          <polygon points="100,0 100,100 0,100" />
        </clipPath>
      </defs>
      <rect width="100" height="100" className="sleeve-ground" />
      <g clipPath={`url(#${clip}-a)`} className="sleeve-ink">
        <g transform={`rotate(${spec.turn * 90} 50 50)`}>{FORMS[spec.first]}</g>
      </g>
      <g clipPath={`url(#${clip}-b)`}>
        <rect width="100" height="100" className="sleeve-fill" />
        <g
          className="sleeve-ground-ink"
          transform={`rotate(180 50 50)${spec.mirror ? " translate(100 0) scale(-1 1)" : ""}`}
        >
          {FORMS[spec.second]}
        </g>
      </g>
    </svg>
  );
}

const QUILT: SleeveForm[] = [
  "dots",
  "stripes",
  "arcs",
  "rings",
  "blocks",
  "crosses",
  "bars",
  "waves",
  "grid",
];

/**
 * A headliner's sleeve: a sampler of the forms, nine tiles turned by the headliner's name. The
 * headliners are what every act is matched against, so theirs holds every kind of form rather
 * than claiming two genres.
 */
export function Quilt({ name, className = "" }: { name: string; className?: string }) {
  const seed = hashOf(name);
  const order = QUILT.map((form, i) => QUILT[(i + seed) % QUILT.length]);
  return (
    <svg viewBox="0 0 99 99" className={`sleeve quilt ${className}`} aria-hidden>
      <rect width="99" height="99" className="sleeve-ground" />
      {order.map((form, i) => {
        const x = (i % 3) * 33;
        const y = Math.floor(i / 3) * 33;
        const lit = (i + seed) % 4 === 0;
        return (
          <svg key={i} x={x} y={y} width="33" height="33" viewBox="0 0 100 100">
            <rect
              width="100"
              height="100"
              className={lit ? "quilt-lit" : (i + Math.floor(i / 3)) % 2 ? "sleeve-ground" : "quilt-paper"}
            />
            <g className={(i + Math.floor(i / 3)) % 2 ? "sleeve-ink" : "sleeve-ground-ink"}>
              {FORMS[form]}
            </g>
          </svg>
        );
      })}
    </svg>
  );
}
