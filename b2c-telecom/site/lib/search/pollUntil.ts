export interface PollOptions {
  intervalMs: number;
  /** Maximum number of calls of `check`, at least 1. */
  attempts: number;
  /** Injectable for tests; defaults to a timer. */
  sleep?: (ms: number) => Promise<void>;
}

const timer = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls `check` until it returns true; resolves with the number of the successful attempt (1-based). Sleeps `intervalMs` between
 * attempts only: never after a success and never after the last failed attempt. Rejects when every attempt failed.
 * A throwing `check` counts as a failed attempt (an index that is not ready can answer with an error).
 */
export async function pollUntil(check: () => Promise<boolean>, { intervalMs, attempts, sleep = timer }: PollOptions): Promise<number> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const ready = await check().catch(() => false);
    if (ready) return attempt;
    if (attempt < attempts) await sleep(intervalMs);
  }
  throw new Error(`Not ready after ${attempts} attempts`);
}
