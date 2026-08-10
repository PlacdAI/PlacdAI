// Server-only: wraps a Gemini call with automatic retry for transient
// failures — specifically 429 RESOURCE_EXHAUSTED (rate limit / quota) and
// 503 UNAVAILABLE (overloaded). Built in response to a currently-open
// Google-side bug where paid Tier 1 projects intermittently get rejected
// as if they were an unbilled free-tier project (confirmed on Google's
// own developer forum, affecting both Nano Banana 2 and Veo — not unique
// to this app, and not something fixable from our end). Until Google
// resolves it, retrying smooths over the intermittent failures instead of
// surfacing a hard 500 to the user on every misfire.
//
// Does NOT retry other error types (bad prompt, invalid image, auth
// failures, etc.) — those are real failures that retrying won't fix, and
// silently eating them would just waste time before the same error either
// way.

type RetryOptions = {
  maxAttempts?: number; // total attempts including the first, default 3
  baseDelayMs?: number; // used for exponential backoff when Gemini doesn't tell us a delay, default 2000
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
};

class RetryableError extends Error {
  retryDelayMs?: number;
  constructor(message: string, retryDelayMs?: number) {
    super(message);
    this.retryDelayMs = retryDelayMs;
  }
}

// Gemini's error body includes a RetryInfo block with a suggested delay
// (e.g. "retryDelay": "9s") — honor that instead of guessing, when present.
function parseRetryDelayMs(message: string): number | undefined {
  const m = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (!m) return undefined;
  return Math.ceil(parseFloat(m[1]) * 1000);
}

function isTransientGeminiError(err: unknown): { retryable: boolean; retryDelayMs?: number } {
  const message = err instanceof Error ? err.message : String(err);
  // Our Gemini call sites throw errors shaped like
  // "Gemini generation 429: { ...full error body... }" or "... 503: ...".
  const statusMatch = message.match(/Gemini (?:generation|call) (\d{3}):/);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;
  if (status === 429 || status === 503) {
    return { retryable: true, retryDelayMs: parseRetryDelayMs(message) };
  }
  return { retryable: false };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wrap any Gemini call (or anything that throws the same "Gemini
 * generation <status>: <body>" shaped error) with automatic retry on
 * transient 429/503s.
 *
 * Usage:
 *   const image = await withGeminiRetry(() => streamImage(prompt, parts));
 */
export async function withGeminiRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 2000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const { retryable, retryDelayMs } = isTransientGeminiError(err);
      if (!retryable || attempt === maxAttempts) throw err;

      // Prefer Gemini's own suggested delay; otherwise exponential
      // backoff with a little jitter so concurrent requests don't all
      // retry in lockstep.
      const delay = retryDelayMs ?? baseDelayMs * 2 ** (attempt - 1) + Math.random() * 500;
      opts.onRetry?.(attempt, delay, err);
      await sleep(delay);
    }
  }
  // Unreachable (loop always returns or throws), but keeps TS satisfied.
  throw lastError;
}