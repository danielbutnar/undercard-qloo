import { BuildEventSchema, type BuildEvent } from "@/lib/build-events";
import { takeLines } from "@/lib/build-state";

/**
 * POSTs to a route that streams build events as NDJSON and hands each valid event to
 * onEvent as it arrives. Malformed lines are skipped; a failed request throws.
 */
export async function streamEvents(
  url: string,
  body: unknown,
  signal: AbortSignal,
  onEvent: (event: BuildEvent) => void,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body)
    throw new Error(`HTTP ${response.status}`);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const { lines, rest } = takeLines(buffer + value);
    buffer = rest;
    for (const line of lines) {
      try {
        const parsed = BuildEventSchema.safeParse(JSON.parse(line));
        if (parsed.success) onEvent(parsed.data);
      } catch {
        // A malformed line is skipped; the rest of the stream still counts.
      }
    }
  }
}
