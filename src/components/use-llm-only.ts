"use client";

import { useCallback, useState } from "react";
import { z } from "zod";
import { LlmOnlyLineupSchema, PickCheckSchema } from "@/lib/llm-only";
import type { LlmOnlyState } from "./model-bill";

/** Loads the LLM-only lineup once, the first time the board flips to it. */
export function useLlmOnly(festivalId?: string) {
  const [state, setState] = useState<LlmOnlyState>({
    status: "idle",
    lineup: null,
    error: null,
  });

  const load = useCallback(async () => {
    setState((current) =>
      current.status === "ready" || current.status === "loading"
        ? current
        : { ...current, status: "loading", error: null },
    );
    try {
      const response = await fetch("/api/llm-only", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ festival: festivalId }),
      });
      const body = await response.json();
      const lineup = LlmOnlyLineupSchema.safeParse(body?.lineup);
      if (!response.ok || !lineup.success) {
        setState({
          status: "error",
          lineup: null,
          error: body?.error ?? "The model didn't answer. Try again.",
        });
        return;
      }
      // Each pick's checks on Qloo; unreadable ones count as none, and every card says so.
      const checks = z.array(PickCheckSchema).safeParse(body?.checks);
      setState({
        status: "ready",
        lineup: lineup.data,
        error: null,
        ...(checks.success ? { checks: checks.data } : {}),
      });
    } catch {
      setState({
        status: "error",
        lineup: null,
        error: "Couldn't reach the model. Try again.",
      });
    }
  }, [festivalId]);

  return { state, load };
}
