"use client";

import { useEffect, useRef } from "react";

/**
 * Motion on scroll (WS12): an element below the fold waits as data-reveal="pending" and turns
 * "in" when it scrolls into view, which starts its CSS animations. With reduced motion, without
 * IntersectionObserver, or when it is already on screen at load, it never waits: the server's
 * HTML is the end state, so nothing flashes and nothing hides.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (element.getBoundingClientRect().top < window.innerHeight) return;
    element.dataset.reveal = "pending";
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        element.dataset.reveal = "in";
        observer.disconnect();
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);
  return ref;
}
