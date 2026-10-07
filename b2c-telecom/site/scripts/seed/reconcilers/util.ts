import type { CtApi } from '../lib';
import type { Change } from '../types';

export type Obj = Record<string, unknown>;
export type Versioned = { id: string; key?: string; version: number };
export type UpdateAction = Obj & { action: string };
export type UpdatePlan = { changes: Change[]; actions: UpdateAction[]; conflict?: string };

export function asArray(value: unknown): Obj[] {
  return Array.isArray(value) ? (value as Obj[]) : [];
}

/** Structural equality of JSON values; object key order is irrelevant. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  const ao = a as Obj;
  const bo = b as Obj;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    if (ao[k] === undefined && bo[k] === undefined) continue;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

/** True when every field of `draft` is present with the same value in `existing` (extra fields in `existing` are ignored). */
export function covers(existing: unknown, draft: unknown): boolean {
  if (draft === undefined) return true;
  if (draft === null || typeof draft !== 'object') return existing === draft;
  if (existing === null || typeof existing !== 'object') return false;
  if (Array.isArray(draft)) return Array.isArray(existing) && existing.length === draft.length && draft.every((d, i) => covers(existing[i], d));
  return Object.entries(draft as Obj).every(([k, v]) => covers((existing as Obj)[k], v));
}

/** Compares only the fields that the draft sets (undefined in the draft means "not managed"). */
export function field(changes: Change[], path: string, from: unknown, to: unknown): boolean {
  if (to === undefined || deepEqual(from, to)) return false;
  changes.push({ path, from, to });
  return true;
}

export async function getByKey<T = Obj>(api: CtApi, collection: string, key: string, query?: Record<string, string | string[]>): Promise<T | null> {
  return (await api.get(`${collection}/key=${key}`, query)) as T | null;
}

export async function postUpdate(api: CtApi, collection: string, existing: Versioned, actions: UpdateAction[]): Promise<void> {
  if (actions.length === 0) return;
  await api.post(`${collection}/key=${existing.key}`, { version: existing.version, actions });
}

export async function removeByKey(api: CtApi, collection: string, existing: Versioned): Promise<void> {
  await api.del(`${collection}/key=${existing.key}`, { version: existing.version });
}

/** Reads every page of a collection (limit 500 per page). */
export async function getAll(api: CtApi, collection: string, query: Record<string, string | string[]> = {}): Promise<Obj[]> {
  const out: Obj[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = (await api.get(collection, { ...query, limit: 500, offset })) as { results?: Obj[]; total?: number } | null;
    const results = page?.results ?? [];
    out.push(...results);
    if (results.length < 500) return out;
  }
}

const idKeyCache = new WeakMap<CtApi, Map<string, string | null>>();

function cacheFor(api: CtApi): Map<string, string | null> {
  let cache = idKeyCache.get(api);
  if (!cache) {
    cache = new Map();
    idKeyCache.set(api, cache);
  }
  return cache;
}

/** key of the resource with this id (cached per api); null when not found. */
export async function keyOfId(api: CtApi, collection: string, id: string): Promise<string | null> {
  const cache = cacheFor(api);
  const cached = cache.get(`${collection}/${id}`);
  if (cached !== undefined) return cached;
  const res = (await api.get(`${collection}/${id}`)) as { key?: string } | null;
  const key = res?.key ?? null;
  if (key !== null) cache.set(`${collection}/${id}`, key);
  return key;
}

/** id of the resource with this key (cached per api); null when not found. */
export async function idOfKey(api: CtApi, collection: string, key: string): Promise<string | null> {
  const cache = cacheFor(api);
  const cacheKey = `${collection}/key=${key}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  const res = (await api.get(cacheKey)) as { id?: string } | null;
  const id = res?.id ?? null;
  if (id !== null) cache.set(cacheKey, id);
  return id;
}

export function clearIdCache(api: CtApi): void {
  idKeyCache.delete(api);
}
