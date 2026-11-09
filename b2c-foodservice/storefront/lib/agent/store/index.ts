import 'server-only';
import { BlobsSessionStore } from './blobs-store';
import { MemorySessionStore } from './memory-store';
import type { SessionStore } from './session-store';

/**
 * `next dev` loads each route into its own module instance, so a module-level variable would give /api/assistant/session and
 * /api/assistant/turn two different in-memory stores (the turn then finds no session and answers 404). The dev store therefore lives on
 * `globalThis`. Production never uses it: Netlify Blobs is shared by every instance.
 */
const DEV_STORE_KEY = '__malvaAssistantDevSessionStore';

/**
 * The session store for this process: Netlify Blobs in production, an in-memory store for tests and `next dev` (it refuses to construct
 * in production). A hosted preview must set NODE_ENV=production, which Next does for every build, so it gets Blobs.
 */
export function getSessionStore(): SessionStore {
  if (process.env.NODE_ENV === 'production') return new BlobsSessionStore();
  const scope = globalThis as unknown as Record<string, SessionStore | undefined>;
  scope[DEV_STORE_KEY] ??= new MemorySessionStore();
  return scope[DEV_STORE_KEY];
}

export type { SessionStore } from './session-store';
