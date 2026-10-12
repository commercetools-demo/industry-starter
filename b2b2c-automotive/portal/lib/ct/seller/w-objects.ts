// Custom objects of workstream W (containers `malva-coop-campaigns`, `malva-coop-claims`, `malva-email-templates`,
// `malva-email-campaigns`, `malva-local-review`). Every store-owned object has the key `<storeKey>--<id>` AND carries `storeKey`
// in its value; reads check the value, so a key prefix collision can never leak another store's object.
import 'server-only';
import { isNotFound, retryOnConflict } from './versioned';
import { wRoot } from './w-root';

export const CONTAINERS = {
  campaigns: 'malva-coop-campaigns',
  claims: 'malva-coop-claims',
  templates: 'malva-email-templates',
  emailCampaigns: 'malva-email-campaigns',
  localReview: 'malva-local-review',
} as const;

export interface StoredObject<T> {
  key: string;
  version: number;
  value: T;
}

export const storeObjectKey = (storeKey: string, id: string): string => `${storeKey}--${id}`;

export async function readObject<T>(container: string, key: string): Promise<StoredObject<T> | null> {
  const root = await wRoot();
  try {
    const { body } = await root.customObjects().withContainerAndKey({ container, key }).get().execute();
    return { key: body.key, version: body.version, value: body.value as T };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** Create or replace; `change` receives the current value (or null) and returns the new one. Retries on a version conflict. */
export async function upsertObject<T>(container: string, key: string, change: (current: T | null) => T): Promise<T> {
  const root = await wRoot();
  return retryOnConflict(async () => {
    const current = await readObject<T>(container, key);
    const value = change(current?.value ?? null);
    await root.customObjects().post({ body: { container, key, value: value as never, ...(current ? { version: current.version } : {}) } }).execute();
    return value;
  });
}

export async function listObjects<T>(container: string): Promise<StoredObject<T>[]> {
  const root = await wRoot();
  const out: StoredObject<T>[] = [];
  for (let offset = 0; ; offset += 500) {
    const { body } = await root.customObjects().withContainer({ container }).get({ queryArgs: { limit: 500, offset } }).execute();
    out.push(...body.results.map((o) => ({ key: o.key, version: o.version, value: o.value as T })));
    if (offset + body.results.length >= (body.total ?? 0) || body.results.length === 0) break;
  }
  return out;
}

/** The store's own objects of a container: key prefix and the `storeKey` of the value must both match. */
export async function listStoreObjects<T extends { storeKey?: unknown }>(container: string, storeKey: string): Promise<StoredObject<T>[]> {
  return (await listObjects<T>(container)).filter((o) => o.key.startsWith(`${storeKey}--`) && o.value.storeKey === storeKey);
}
