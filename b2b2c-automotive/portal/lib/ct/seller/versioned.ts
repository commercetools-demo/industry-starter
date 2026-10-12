// Optimistic concurrency helpers (skill commercetools-commerce-patterns: on a 409 ConcurrentModification re-read and retry
// with the LATEST version, never the failed one). `attempt` must read the resource itself, so every try starts from the
// current version.
import 'server-only';

export const statusOf = (error: unknown): number | undefined => (error as { statusCode?: number } | null)?.statusCode;
export const isConflict = (error: unknown): boolean => statusOf(error) === 409;
export const isNotFound = (error: unknown): boolean => statusOf(error) === 404;

export async function retryOnConflict<T>(attempt: () => Promise<T>, tries = 5): Promise<T> {
  for (let n = 1; ; n += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (!isConflict(error) || n >= tries) throw error;
    }
  }
}

/** Chunks of at most `size` items (commercetools accepts at most 100 update actions per request). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
