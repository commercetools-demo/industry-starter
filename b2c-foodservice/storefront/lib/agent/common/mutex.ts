// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from commerce-common/commerce_common/execution.py (the per-session asyncio.Lock); changes: promise-chain mutex keyed by session.

/**
 * Serialises async work per key. Genuinely needed in single-threaded JavaScript: a round's tool calls are dispatched concurrently, so two
 * cart adds interleave at every `await`, both read the same "before", and the line lands over the cap.
 *
 * - Chain with `.then(fn, fn)` so a failed predecessor cannot wedge everything behind it.
 * - Delete the map entry only if it is still the tail; otherwise one entry leaks per key per warm instance.
 * - It covers ONE process. A horizontally scaled host will routinely have two invocations for one session, so the backend's writes also
 *   need the platform's own concurrency handling (here: read-back verification and one retry).
 */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<unknown>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(fn, fn);
    const tail = result.catch(() => undefined);
    this.tails.set(key, tail);
    try {
      return await result;
    } finally {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }

  get size(): number {
    return this.tails.size;
  }
}
