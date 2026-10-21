import 'server-only';
import { AppError } from '@/lib/errors';

function isConflict(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { statusCode?: unknown }).statusCode === 409;
}

/**
 * Optimistic concurrency: read, write with the read version. On a 409 (ConcurrentModification)
 * re-read and write once more; a second 409 becomes a `conflict` AppError. No delay.
 */
export async function updateWithRetry<T extends { version: number }, R>(
  read: () => Promise<T>,
  write: (current: T) => Promise<R>,
): Promise<R> {
  try {
    return await write(await read());
  } catch (e) {
    if (!isConflict(e)) throw e;
  }
  try {
    return await write(await read());
  } catch (e) {
    if (isConflict(e)) throw new AppError('conflict', 409);
    throw e;
  }
}
