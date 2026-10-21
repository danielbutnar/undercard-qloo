"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Rows that glide to their new places when a chart re-sorts (FLIP, Web Animations API only): a
 * row that moved slides from where it was, a new row rises in from below. `key` changes once
 * per re-sort; with `enabled` false (reduced motion) rows simply appear in place.
 */
export function useFlip<T extends HTMLElement>(
  key: unknown,
  enabled: boolean,
  duration = 700,
) {
  const nodes = useRef(new Map<string, T>());
  const last = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    for (const [id, node] of nodes.current) {
      const box = node.getBoundingClientRect();
      next.set(id, box);
      if (!enabled || typeof node.animate !== "function") continue;
      const before = last.current.get(id);
      if (before && Math.abs(before.top - box.top) < 1) continue;
      node.animate(
        before
          ? [
              { transform: `translateY(${before.top - box.top}px)` },
              { transform: "none" },
            ]
          : [
              { transform: "translateY(28px)", opacity: 0 },
              { transform: "none", opacity: 1 },
            ],
        { duration, easing: "cubic-bezier(.2,.75,.15,1)" },
      );
    }
    last.current = next;
  }, [key, enabled, duration]);

  return useCallback(
    (id: string) => (node: T | null) => {
      if (node) nodes.current.set(id, node);
      else nodes.current.delete(id);
    },
    [],
  );
}
