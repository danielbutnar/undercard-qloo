import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { QLOO_BASE_URL, type QlooPath } from "@/lib/qloo/core";
import { callKey, type Ask } from "./control-test-37";

/**
 * Section 37's client (scripts/control-test-37.ts). It keeps its own memory and nothing else: it
 * takes no cache, so it can't read or write the server's Qloo cache, whose entries the saved
 * 1.0 builds' replays and venue switch are rebuilt from (docs/evidence.md section 37, added on
 * 2026-10-24). Each answer it receives goes to its record, the raw answers in .design/evidence-37/
 * (git-ignored), and a RESUME reads them back so no call is made twice. One call at a time,
 * spaced; it stops at the first answer that isn't a usable one (a 429, a rate-limit or quota
 * answer, any other error, or none), never retrying, and before an attempt past MAX_CALLS.
 */

/** A Qloo answer as the run received it. */
export interface SavedAnswer {
  key: string;
  path: QlooPath;
  params: Record<string, string>;
  status: number;
  /** When it was asked, ISO time. */
  at: string;
  body: unknown;
}

/** Every request the run sent, answered or not, so a retry or a stop shows. */
export interface Attempt {
  n: number;
  at: string;
  key: string;
  status: number | null;
  /** Why the run stopped at this attempt. */
  stop?: StopReason;
  /** The start of an error answer's text, for the record only. */
  note?: string;
}

/** Where the run keeps what it receives. */
export interface RunRecord {
  answers(): SavedAnswer[];
  saveAnswer(answer: SavedAnswer): void;
  attempts(): Attempt[];
  saveAttempt(attempt: Attempt): void;
}

export type StopReason =
  | "max calls"
  | "rate limit"
  | "quota"
  | "http error"
  | "unsuccessful answer"
  | "unreadable"
  | "no answer";

/** The run stops here: what it has is kept, and RESUME carries on from it. */
export class RunStopped extends Error {
  constructor(
    readonly reason: StopReason,
    readonly detail: string,
  ) {
    super(`Stopped (${reason}): ${detail}`);
    this.name = "RunStopped";
  }
}

const REQUEST_TIMEOUT_MS = 20_000;
/** Section 34's spacing between calls (1.2 s), gentle on the shared key's rate limit. */
export const SPACING_MS = 1200;

function stopFor(status: number, text: string): StopReason {
  if (/quota/i.test(text)) return "quota";
  if (status === 429 || /rate.?limit|too many requests/i.test(text))
    return "rate limit";
  return "http error";
}

export function createRunClient({
  apiKey,
  baseUrl = QLOO_BASE_URL,
  fetch,
  record,
  maxCalls,
  spacingMs = SPACING_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  resume = false,
  known = [],
}: {
  apiKey: string;
  baseUrl?: string;
  fetch: typeof globalThis.fetch;
  record: RunRecord;
  /** The most requests this run may send. */
  maxCalls: number;
  spacingMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Start from the record's answers, so none is asked again. */
  resume?: boolean;
  /** Answers another phase of the same run received (the side check reads the main run's). */
  known?: readonly SavedAnswer[];
}) {
  const memory = new Map<string, unknown>();
  for (const answer of known) memory.set(answer.key, answer.body);
  if (resume)
    for (const answer of record.answers()) memory.set(answer.key, answer.body);
  let number = record
    .attempts()
    .reduce((top, entry) => Math.max(top, entry.n), 0);
  let attempts = 0;
  let fetched = 0;
  let fromMemory = 0;
  let stopped: RunStopped | null = null;
  // One call at a time: each ask waits for the one before it.
  let queue: Promise<unknown> = Promise.resolve();

  async function call(
    path: QlooPath,
    params: Record<string, string | number>,
  ): Promise<unknown> {
    const key = callKey(path, params);
    if (memory.has(key)) {
      fromMemory++;
      return memory.get(key);
    }
    if (stopped) throw stopped;
    if (attempts >= maxCalls) {
      stopped = new RunStopped(
        "max calls",
        `${maxCalls} requests sent, the most this run may send`,
      );
      throw stopped;
    }
    if (attempts > 0 && spacingMs > 0) await sleep(spacingMs);
    attempts++;
    const n = ++number;
    const at = new Date(now()).toISOString();
    const stop = (
      reason: StopReason,
      status: number | null,
      detail: string,
      note?: string,
    ) => {
      record.saveAttempt({
        n,
        at,
        key,
        status,
        stop: reason,
        ...(note ? { note } : {}),
      });
      stopped = new RunStopped(reason, `${detail} (request ${n}, ${path})`);
      return stopped;
    };

    const url = new URL(path, baseUrl);
    for (const [name, value] of Object.entries(params))
      url.searchParams.set(name, String(value));
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw stop(
        "no answer",
        null,
        error instanceof Error ? error.name : "no answer",
      );
    }
    const text = await response.text().catch(() => "");
    if (!response.ok)
      throw stop(
        stopFor(response.status, text),
        response.status,
        `HTTP ${response.status}`,
        text.slice(0, 200),
      );
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw stop("unreadable", response.status, "an answer that isn't JSON");
    }
    if (
      body &&
      typeof body === "object" &&
      (body as { success?: unknown }).success === false
    ) {
      const reason = stopFor(0, text);
      throw stop(
        reason === "http error" ? "unsuccessful answer" : reason,
        response.status,
        "an answer marked unsuccessful",
        text.slice(0, 200),
      );
    }
    record.saveAnswer({
      key,
      path,
      params: Object.fromEntries(
        Object.entries(params).map(([name, value]) => [name, String(value)]),
      ),
      status: response.status,
      at,
      body,
    });
    record.saveAttempt({ n, at, key, status: response.status });
    memory.set(key, body);
    fetched++;
    return body;
  }

  const ask: Ask = (path, params) => {
    const next = queue.then(() => call(path, params));
    queue = next.catch(() => undefined);
    return next;
  };

  return {
    ask,
    counts: () => ({ attempts, fetched, fromMemory }),
    stopped: () => stopped,
  };
}

export type RunClient = ReturnType<typeof createRunClient>;

/** A record in memory, for tests and dry runs. */
export function memoryRecord(): RunRecord {
  const answers: SavedAnswer[] = [];
  const attempts: Attempt[] = [];
  return {
    answers: () => [...answers],
    saveAnswer: (answer) => void answers.push(answer),
    attempts: () => [...attempts],
    saveAttempt: (attempt) => void attempts.push(attempt),
  };
}

function readLines<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        // A line torn by a run that was killed mid-write: its call is asked again.
        return [];
      }
    });
}

/**
 * The record in a folder, one JSON line per answer (answers.ndjson) and per attempt
 * (attempts.ndjson), appended as they come so a stop or a crash loses nothing.
 */
export function fileRecord(dir: string, prefix = ""): RunRecord {
  const answersFile = join(dir, `${prefix}answers.ndjson`);
  const attemptsFile = join(dir, `${prefix}attempts.ndjson`);
  const started = new Set<string>();
  const append = (file: string, value: unknown) => {
    mkdirSync(dir, { recursive: true });
    // After a torn last line, the next line starts on a line of its own.
    const torn =
      !started.has(file) &&
      existsSync(file) &&
      !/(^|\n)$/.test(readFileSync(file, "utf8"));
    started.add(file);
    appendFileSync(file, `${torn ? "\n" : ""}${JSON.stringify(value)}\n`);
  };
  return {
    answers: () => readLines<SavedAnswer>(answersFile),
    saveAnswer: (answer) => append(answersFile, answer),
    attempts: () => readLines<Attempt>(attemptsFile),
    saveAttempt: (attempt) => append(attemptsFile, attempt),
  };
}
