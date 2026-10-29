import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The bar over every screen: the product's name, back to Sagebrush Sound, and the other screens.
 * A screen adds its own links before the shared ones.
 */
export function TopBar({
  children,
  method = true,
  yours = true,
  pitch = true,
}: {
  children?: ReactNode;
  method?: boolean;
  yours?: boolean;
  /** The pitch check, in every page's nav under one name (Daniel, 2026-10-29, WS18 item 4). */
  pitch?: boolean;
}) {
  return (
    <header className="topbar">
      {/* One wordmark on every page, as the landing sets it (WS12 item 7). */}
      <Link
        href="/"
        className="logo wordmark"
        aria-label="Undercard, back to Sagebrush Sound"
      >
        Undercard
      </Link>
      <nav aria-label="Other screens" className="nav">
        {children}
        {method && <Link href="/method">How it works</Link>}
        {yours && <Link href="/your-festival">Your festival</Link>}
        {pitch && (
          <Link href="/shortlist" prefetch={false}>
            Check a shortlist
          </Link>
        )}
      </nav>
    </header>
  );
}
