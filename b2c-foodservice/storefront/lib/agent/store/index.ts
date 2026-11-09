import 'server-only';
import { BlobsSessionStore } from './blobs-store';
import { MemorySessionStore } from './memory-store';
import type { SessionStore } from './session-store';

let cached: SessionStore | undefined;

/**
 * The session store for this process: Netlify Blobs in production, an in-memory store for tests and `next dev` (it refuses to construct
 * in production). A hosted preview must set NODE_ENV=production, which Next does for every build, so it gets Blobs.
 */
export function getSessionStore(): SessionStore {
  cached ??= process.env.NODE_ENV === 'production' ? new BlobsSessionStore() : new MemorySessionStore();
  return cached;
}

export type { SessionStore } from './session-store';
