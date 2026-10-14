/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Custom objects of workstream V: `malva-customer-notes` (`<storeKey>--<customerId>`), `malva-subscription-audit`
// (`<storeKey>--<recurringOrderId>--<n>`) and `malva-impersonation` (`<jti>`). Every value carries `storeKey`; reads check it, so a key
// prefix collision can never show another store's record.
import 'server-only';
import { isConflict, isNotFound, retryOnConflict } from './versioned';
import { vRoot } from './v-root';

export const V_CONTAINERS = {
  notes: 'malva-customer-notes',
  audit: 'malva-subscription-audit',
  impersonation: 'malva-impersonation',
} as const;

export interface StoredObject<T> {
  key: string;
  version: number;
  value: T;
}

export async function readObject<T>(container: string, key: string): Promise<StoredObject<T> | null> {
  const root = await vRoot();
  try {
    const { body } = await root.customObjects().withContainerAndKey({ container, key }).get().execute();
    return { key: body.key, version: body.version, value: body.value as T };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** Create or replace; `change` receives the current value (or null). Retries on a version conflict. */
export async function upsertObject<T>(container: string, key: string, change: (current: T | null) => T): Promise<T> {
  const root = await vRoot();
  return retryOnConflict(async () => {
    const current = await readObject<T>(container, key);
    const value = change(current?.value ?? null);
    await root.customObjects().post({ body: { container, key, value: value as never, version: current ? current.version : 0 } }).execute();
    return value;
  });
}

/** Objects of a container whose value matches a custom object predicate such as `value(storeKey="a")`. */
export async function listObjects<T>(container: string, where?: string): Promise<StoredObject<T>[]> {
  const root = await vRoot();
  const out: StoredObject<T>[] = [];
  for (let offset = 0; ; offset += 500) {
    const { body } = await root
      .customObjects()
      .withContainer({ container })
      .get({ queryArgs: { limit: 500, offset, ...(where ? { where } : {}), withTotal: true } })
      .execute();
    out.push(...body.results.map((o) => ({ key: o.key, version: o.version, value: o.value as T })));
    if (offset + body.results.length >= (body.total ?? 0) || body.results.length === 0) break;
  }
  return out;
}

/** Writes a new object that must not exist yet (`version: 0`); on a clash the next key from `nextKey` is tried. */
export async function createObject<T>(container: string, nextKey: (attempt: number) => string, value: T, tries = 5): Promise<string> {
  const root = await vRoot();
  for (let attempt = 1; ; attempt += 1) {
    const key = nextKey(attempt);
    try {
      await root.customObjects().post({ body: { container, key, value: value as never, version: 0 } }).execute();
      return key;
    } catch (error) {
      if (!isConflict(error) || attempt >= tries) throw error;
    }
  }
}
