"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Rows that glide to their new places when a list re-sorts (FLIP, Web Animations API only): a
 * row that moved slides from where it was, a new row rises in. `key` changes once per re-sort.
 */
export function useFlip<T extends HTMLElement>(
  key: unknown,
  enabled: boolean,
  duration = 650,
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
      if (before && before.top === box.top) continue;
      node.animate(
        before
          ? [
              { transform: `translateY(${before.top - box.top}px)` },
              { transform: "none" },
            ]
          : [
              { transform: "translateY(18px)", opacity: 0 },
              { transform: "none", opacity: 1 },
            ],
        { duration, easing: "cubic-bezier(.2,.7,.2,1)" },
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
