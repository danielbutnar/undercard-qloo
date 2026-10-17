import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";

/** The routes that spend paid or quota-limited calls. Replaying a saved build is not one. */
export type LimitedAction = "build" | "refill" | "llmOnly";

export interface ActionLimit {
  /** Per client IP, per UTC day. */
  perIp: number;
  /** For everyone together, per UTC day. */
  perDay: number;
  noun: string;
  hint: string;
}

export const LIMITS: Record<LimitedAction, ActionLimit> = {
  // A fresh build runs the agent: up to 12 Qloo calls and a few Claude turns.
  build: {
    perIp: 30, // M6m: raised for the 25 checked-town builds, then back to 5
    perDay: 60,
    noun: "fresh builds",
    hint: " The saved build still replays instantly.",
  },
  // A refill makes up to 3 Qloo calls.
  refill: { perIp: 25, perDay: 500, noun: "refills", hint: "" },
  // Counted only when the model is asked; the saved answer is free.
  llmOnly: { perIp: 10, perDay: 100, noun: "LLM-only requests", hint: "" },
};

export type LimitResult =
  | { allowed: true }
  | { allowed: false; message: string; retryAfterSeconds: number };

export interface RateLimiter {
  kind: "memory" | "upstash";
  check(action: LimitedAction, ip: string): Promise<LimitResult>;
}

type Scope = "ip" | "all";
interface Window {
  limit(identifier: string): Promise<{ success: boolean; reset: number }>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function limiterFrom(
  kind: RateLimiter["kind"],
  limits: Record<LimitedAction, ActionLimit>,
  window: (action: LimitedAction, scope: Scope) => Window,
  now: () => number,
): RateLimiter {
  const denied = (message: string, reset: number): LimitResult => ({
    allowed: false,
    message,
    retryAfterSeconds: Math.max(1, Math.ceil((reset - now()) / 1000)),
  });
  return {
    kind,
    async check(action, ip) {
      const rule = limits[action];
      try {
        const own = await window(action, "ip").limit(ip);
        if (!own.success) {
          return denied(
            `You've used today's ${rule.perIp} ${rule.noun} from this network.${rule.hint} Try again tomorrow (UTC).`,
            own.reset,
          );
        }
        const everyone = await window(action, "all").limit("all");
        if (!everyone.success) {
          return denied(
            `Undercard has reached today's limit of ${rule.perDay} ${rule.noun} for everyone.${rule.hint} Try again tomorrow (UTC).`,
            everyone.reset,
          );
        }
        return { allowed: true };
      } catch {
        // Without a working limiter, nothing paid runs.
        return {
          allowed: false,
          message:
            "Rate limiting is unavailable right now. Try again in a minute.",
          retryAfterSeconds: 60,
        };
      }
    },
  };
}

/** Daily fixed windows in Upstash Redis; they reset at midnight UTC. */
export function createUpstashLimiter(
  redis: Redis,
  limits = LIMITS,
  prefix = "undercard:rl",
): RateLimiter {
  const windows = new Map<string, Ratelimit>();
  return limiterFrom(
    "upstash",
    limits,
    (action, scope) => {
      const key = `${action}:${scope}`;
      let window = windows.get(key);
      if (!window) {
        const tokens =
          scope === "ip" ? limits[action].perIp : limits[action].perDay;
        window = new Ratelimit({
          redis,
          limiter: Ratelimit.fixedWindow(tokens, "1 d"),
          prefix: `${prefix}:${key}`,
        });
        windows.set(key, window);
      }
      return window;
    },
    Date.now,
  );
}

/** The same daily windows in process memory, for local runs without Upstash and for tests. */
export function createMemoryLimiter({
  limits = LIMITS,
  now = Date.now,
}: {
  limits?: Record<LimitedAction, ActionLimit>;
  now?: () => number;
} = {}): RateLimiter {
  const counts = new Map<string, number>();
  return limiterFrom(
    "memory",
    limits,
    (action, scope) => ({
      async limit(identifier) {
        const day = Math.floor(now() / DAY_MS);
        const key = `${action}:${scope}:${identifier}:${day}`;
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        const tokens =
          scope === "ip" ? limits[action].perIp : limits[action].perDay;
        return { success: count <= tokens, reset: (day + 1) * DAY_MS };
      },
    }),
    now,
  );
}

/** The caller's IP as Vercel reports it; everyone without one shares the "unknown" allowance. */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
