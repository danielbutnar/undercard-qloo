import Link from "next/link";
import type { ReactNode } from "react";

/** The mark: a chart's three rising bars, the last one lit. */
export function Logo() {
  return (
    <svg viewBox="0 0 30 30" aria-hidden>
      <rect x="1" y="1" width="28" height="28" className="fill-ink" />
      <rect x="6" y="17" width="5" height="8" className="fill-surface" />
      <rect x="12.5" y="12" width="5" height="13" className="fill-surface" />
      <rect x="19" y="6" width="5" height="19" className="fill-accent" />
    </svg>
  );
}

/**
 * The bar over every screen: the product's name, back to Sagebrush Sound, and the other screens.
 * A screen adds its own links before the shared ones.
 */
export function TopBar({
  children,
  method = true,
  yours = true,
}: {
  children?: ReactNode;
  method?: boolean;
  yours?: boolean;
}) {
  return (
    <header className="topbar">
      <Link
        href="/"
        className="logo"
        aria-label="Undercard, back to Sagebrush Sound"
      >
        <Logo />
        Undercard
      </Link>
      <nav aria-label="Other screens" className="nav">
        {children}
        {method && <Link href="/method">How it works</Link>}
        {yours && <Link href="/your-festival">Your festival</Link>}
      </nav>
    </header>
  );
}
