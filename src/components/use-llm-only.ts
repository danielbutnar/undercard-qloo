"use client";

import { useCallback, useState } from "react";
import { LlmOnlyLineupSchema } from "@/lib/llm-only";
import type { LlmOnlyState } from "./model-bill";

/** Loads the LLM-only lineup once, the first time the board flips to it. */
export function useLlmOnly() {
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
      const response = await fetch("/api/llm-only", { method: "POST" });
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
      setState({ status: "ready", lineup: lineup.data, error: null });
    } catch {
      setState({
        status: "error",
        lineup: null,
        error: "Couldn't reach the model. Try again.",
      });
    }
  }, []);

  return { state, load };
}
