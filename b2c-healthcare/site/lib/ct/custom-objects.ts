import 'server-only';
import { apiRoot } from '@/lib/ct/client';

/** Custom Object containers used by the storefront (workstream F). Keys and containers allow only `[-_~.a-zA-Z0-9]`. */
export const CONTAINERS = {
  schedule: 'malva-schedule',
  slotClaim: 'malva-slot-claim',
  booking: 'malva-booking',
  rx: 'malva-rx',
  lab: 'malva-lab',
  credential: 'malva-credential',
  counter: 'malva-counter',
  ratelimit: 'malva-ratelimit',
  /** One entry per order id: what an order consumed from which prescription (workstream N). */
  dispenseLedger: 'malva-dispense-ledger',
} as const;

export interface StoredObject<T> { key: string; version: number; value: T }

export const statusOf = (e: unknown): number | undefined => {
  const x = e as { statusCode?: number; code?: number } | undefined;
  return x?.statusCode ?? x?.code;
};

/** Reads one object; `null` when it does not exist. */
export async function getObject<T>(container: string, key: string): Promise<StoredObject<T> | null> {
  try {
    const { body } = await apiRoot.customObjects().withContainerAndKey({ container, key }).get().execute();
    return { key: body.key, version: body.version, value: body.value as T };
  } catch (e) {
    if (statusOf(e) === 404) return null;
    throw e;
  }
}

/** Create or replace. With `version`, the write succeeds only if the stored version matches (409 otherwise). */
export async function putObject<T>(container: string, key: string, value: T, version?: number): Promise<StoredObject<T>> {
  const { body } = await apiRoot.customObjects().post({ body: { container, key, value: value as never, ...(version !== undefined ? { version } : {}) } }).execute();
  return { key: body.key, version: body.version, value: body.value as T };
}

/**
 * Create-only write: `version: 0` makes a second create of the same container/key fail with 409.
 * Returns false when the object already exists (the caller decides what that means).
 */
export async function createOnly<T>(container: string, key: string, value: T): Promise<boolean> {
  try {
    await putObject(container, key, value, 0);
    return true;
  } catch (e) {
    if (statusOf(e) === 409) return false;
    throw e;
  }
}

/** Deletes an object; a missing object is not an error. */
export async function deleteObject(container: string, key: string): Promise<void> {
  try {
    await apiRoot.customObjects().withContainerAndKey({ container, key }).delete({}).execute();
  } catch (e) {
    if (statusOf(e) !== 404) throw e;
  }
}

/** Every object of a container matching a `where` predicate (pages of 200). */
export async function queryObjects<T>(container: string, where?: string): Promise<StoredObject<T>[]> {
  const out: StoredObject<T>[] = [];
  for (let offset = 0; ; offset += 200) {
    const { body } = await apiRoot.customObjects().withContainer({ container }).get({ queryArgs: { limit: 200, offset, ...(where ? { where } : {}) } }).execute();
    out.push(...body.results.map((o) => ({ key: o.key, version: o.version, value: o.value as T })));
    if (body.results.length < 200) return out;
  }
}
