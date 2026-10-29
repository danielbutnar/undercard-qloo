/**
 * The ↑ drawn as a shape, for type set in Anton (Daniel, 2026-10-29, WS18 item 1): Anton's own
 * arrow reads as a "1", so the ticket's "↑22" read "122". Decorative: the element it sits in
 * says the climb in words. Sized to the text it leads, in its colour.
 */
export function UpArrow({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 10 14"
      className={`up-arrow ${className}`.trim()}
      aria-hidden
      focusable="false"
    >
      <path d="M5 0.5 L9.6 6.2 H6.5 V13.5 H3.5 V6.2 H0.4 Z" />
    </svg>
  );
}
