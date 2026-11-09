import { type LoadedSession, type SessionStore, type StoredSession, VersionConflict, decodeSession, encodeSession } from './session-store';

/**
 * In-memory store for tests and `next dev` ONLY. It refuses to construct when `NODE_ENV` is `production`: on a horizontally scaled host a
 * module-level map splits one session across processes.
 */
export class MemorySessionStore implements SessionStore {
  private readonly records = new Map<string, { json: string; version: number }>();

  constructor(env: Record<string, string | undefined> = process.env) {
    if (env.NODE_ENV === 'production') throw new Error('MemorySessionStore must not be used in production');
  }

  async get(id: string): Promise<LoadedSession | null> {
    const rec = this.records.get(id);
    return rec ? { session: decodeSession(rec.json), version: String(rec.version) } : null;
  }

  async create(session: StoredSession): Promise<string> {
    if (this.records.has(session.id)) throw new VersionConflict();
    this.records.set(session.id, { json: encodeSession(session), version: 1 });
    return '1';
  }

  async save(session: StoredSession, expectedVersion: string): Promise<string> {
    const rec = this.records.get(session.id);
    if (!rec || String(rec.version) !== expectedVersion) throw new VersionConflict();
    const next = { json: encodeSession(session), version: rec.version + 1 };
    this.records.set(session.id, next);
    return String(next.version);
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}
