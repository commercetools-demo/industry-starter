import type { Message } from '../common/prompt-assembly';
import type { Product } from '../shopping/types';

/**
 * Session storage: provenance state and the transcript must be loadable by a request on ANOTHER process. A module-level `Map` is not a
 * store when functions scale horizontally (it would split one session across instances, which the safety table forbids).
 *
 * One JSON document per session, guarded by one version. Divergence from the reference's two-record layout (a small state document plus an
 * appended transcript), on purpose: with one document there is exactly one atomic compare-and-set, so there is no ordering to get wrong
 * between "state first" and "then the messages", and no orphaned half-written transcript. The price is rewriting the transcript each turn
 * (compaction keeps it bounded); `store.test.ts` measures the stored size.
 *
 * RULES the stores keep:
 *  - the compare-and-set `save` RETURNS the version now held; callers never predict `version + 1` (a store may not bump a version when the
 *    value is unchanged, and a predicted version the store never reached is refused as a lost race on the next save);
 *  - absent optional fields are OMITTED, never null (some stores drop nulls, others keep them: omission is deliberate and round-trip tested);
 *  - provenance is an ARRAY in insertion order, not an object: eviction order is insertion order, and JavaScript hoists integer-like keys
 *    (numeric SKUs) ahead of every other key, so an object would come back evicting in an order nobody chose.
 */

/** The identity bound at session start from the SIGNED cookie. Never taken from a request body or a tool argument. */
export interface Principal {
  /** The customer id when signed in, else the anonymous id: what the agent calls `userId`. */
  userId: string;
  customerId?: string;
  anonymousId?: string;
  country?: string;
  locale?: string;
  currency?: string;
  /** A validated IANA zone, or absent (then the prompt carries no local time). */
  timezone?: string;
}

export interface StoredSession {
  /** The unguessable session id. It is also the request credential: never logged, only a digest of it is. */
  id: string;
  principal: Principal;
  /** Newest last; length is bounded by the deployment's provenance cap. */
  provenance: [string, Product][];
  messages: Message[];
  createdAt: string;
}

export interface LoadedSession {
  session: StoredSession;
  /** Opaque; pass back to `save`. */
  version: string;
}

/** A save lost a race (another request wrote first), or `create` found the id taken. Nothing was written. */
export class VersionConflict extends Error {
  constructor() {
    super('session version conflict');
    this.name = 'VersionConflict';
  }
}

export interface SessionStore {
  get(id: string): Promise<LoadedSession | null>;
  /** Creates the record; throws `VersionConflict` if the id exists. Returns the version held. */
  create(session: StoredSession): Promise<string>;
  /** Compare-and-set. Throws `VersionConflict` (and writes nothing) when `expectedVersion` is not the version held. Returns the version NOW held. */
  save(session: StoredSession, expectedVersion: string): Promise<string>;
  delete(id: string): Promise<void>;
}

/** Serialise with omission semantics (JSON drops `undefined`). */
export function encodeSession(session: StoredSession): string {
  return JSON.stringify(session);
}

export function decodeSession(raw: unknown): StoredSession {
  const value = (typeof raw === 'string' ? JSON.parse(raw) : raw) as StoredSession;
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !Array.isArray(value.provenance) || !Array.isArray(value.messages)) {
    throw new Error('corrupt session record');
  }
  return value;
}
