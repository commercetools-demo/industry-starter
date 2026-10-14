/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// The one permitted file that talks to the commercetools Import API (W-14). The Import API is served by its own host, which the
// SDK does not cover, so this file (and only this file) may use fetch against it (lint exemption in eslint.config.mjs).
// Flow: container + chunks of 20 product drafts, wait until every operation has reached a final state (no ordering guarantee),
// then a second container with the standalone prices. Prices are standalone prices on the store's distribution channel.
import 'server-only';
import { standalonePriceKey } from '@/lib/catalog/price-keys';
import { LOCAL_PART_TYPE } from './columns';
import type { ImportItem } from './validate';

export const IMPORT_CHUNK = 20;

export type ImportResourceType = 'product-draft' | 'standalone-price';

export interface ImportOperationState {
  resourceKey: string;
  state: string;
  errors: string[];
}

/** One seam for the three calls the flow needs. The live one speaks HTTP; tests and the dev fixture mode use in-memory ones. */
export interface ImportTransport {
  createContainer(key: string, resourceType: ImportResourceType): Promise<void>;
  /** One import request (at most 20 resources). */
  importResources(container: string, resourceType: ImportResourceType, resources: unknown[]): Promise<void>;
  operations(container: string): Promise<ImportOperationState[]>;
}

/** `https://api.<region>.<cloud>.commercetools.com` becomes `https://import.<region>.<cloud>.commercetools.com`. */
export function importHost(apiUrl: string): string {
  const url = new URL(apiUrl);
  if (!url.hostname.startsWith('api.')) throw new Error('CTP_API_URL must start with api.');
  url.hostname = `import.${url.hostname.slice('api.'.length)}`;
  return url.origin;
}

export interface LiveConfig {
  projectKey: string;
  apiUrl: string;
  authUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
}

/** HTTP transport: a client-credentials token (scope manage_import_containers must be in CTP_ADMIN_SCOPES) and the import host. */
export function liveTransport(config: LiveConfig, fetcher: typeof fetch = fetch): ImportTransport {
  const base = `${importHost(config.apiUrl)}/${encodeURIComponent(config.projectKey)}`;
  let token: { value: string; expires: number } | undefined;
  async function authorization(): Promise<string> {
    if (token && token.expires > Date.now()) return `Bearer ${token.value}`;
    const body = new URLSearchParams({ grant_type: 'client_credentials', scope: config.scopes });
    const response = await fetcher(`${config.authUrl.replace(/\/$/, '')}/oauth/token`, {
      method: 'POST',
      headers: { authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) throw new Error(`Import API token request failed (${response.status})`);
    const data = (await response.json()) as { access_token: string; expires_in: number };
    token = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
    return `Bearer ${token.value}`;
  }
  async function call(method: 'GET' | 'POST', path: string, json?: unknown): Promise<unknown> {
    const response = await fetcher(`${base}${path}`, {
      method,
      headers: { authorization: await authorization(), ...(json === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Import API ${method} ${path.split('?')[0]} failed (${response.status})`);
    return response.json();
  }
  const segment: Record<ImportResourceType, string> = { 'product-draft': 'product-drafts', 'standalone-price': 'standalone-prices' };
  return {
    async createContainer(key, resourceType) {
      await call('POST', '/import-containers', { key, resourceType });
    },
    async importResources(container, resourceType, resources) {
      await call('POST', `/${segment[resourceType]}/import-containers/${encodeURIComponent(container)}`, { type: resourceType, resources });
    },
    async operations(container) {
      const out: ImportOperationState[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = (await call('GET', `/import-containers/${encodeURIComponent(container)}/import-operations?limit=100&offset=${offset}`)) as {
          results: { resourceKey?: string; state: string; errors?: { code?: string; message?: string }[] }[];
          total?: number;
        };
        for (const r of page.results) out.push({ resourceKey: r.resourceKey ?? '', state: r.state, errors: (r.errors ?? []).map((e) => e.message ?? e.code ?? 'error') });
        if (page.results.length === 0 || offset + page.results.length >= (page.total ?? 0)) break;
      }
      return out;
    },
  };
}

/** Product draft import of one local product. `masterVariant.key` is required by the Import API; the key is the SKU. */
export function productDraftResource(item: ImportItem, storeKey: string) {
  return {
    key: item.key,
    productType: { typeId: 'product-type', key: LOCAL_PART_TYPE },
    name: item.name,
    slug: item.slug,
    ...(Object.keys(item.description).length ? { description: item.description } : {}),
    categories: item.categoryKeys.map((key) => ({ typeId: 'category', key })),
    priceMode: 'Standalone',
    masterVariant: {
      key: item.sku,
      sku: item.sku,
      attributes: [
        { name: 'part-number', value: item.sku },
        { name: 'owner-store', value: storeKey },
        { name: 'review-state', value: 'approved' },
      ],
    },
    publish: true,
  };
}

/** Standalone price import on the store's distribution channel. The key follows T's scheme so T's price writer finds it. */
export function standalonePriceResource(item: ImportItem, channelKey: string, currency: 'EUR' | 'USD' = 'EUR') {
  return {
    key: standalonePriceKey(item.sku, channelKey, currency),
    sku: item.sku,
    value: { type: 'centPrecision', currencyCode: currency, centAmount: item.priceCents, fractionDigits: 2 },
    country: currency === 'EUR' ? 'DE' : 'US',
    channel: { typeId: 'channel', key: channelKey },
  };
}

const FAILED = new Set(['validationFailed', 'rejected', 'canceled', 'unresolved']);

export interface RunOptions {
  storeKey: string;
  channelKey: string;
  currency?: 'EUR' | 'USD';
  transport: ImportTransport;
  stamp: string;
  sleep?: (ms: number) => Promise<void>;
  maxWaitMs?: number;
  intervalMs?: number;
}

export interface RunResult {
  imported: string[];
  failed: { sku: string; error: string }[];
  containers: string[];
}

function chunked<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Polls until no operation of the container is `processing` (or waiting); returns the final state per resource key. */
async function settle(transport: ImportTransport, container: string, expected: number, o: Required<Pick<RunOptions, 'sleep' | 'maxWaitMs' | 'intervalMs'>>): Promise<Map<string, ImportOperationState>> {
  const deadline = Date.now() + o.maxWaitMs;
  for (;;) {
    const ops = await transport.operations(container);
    const byKey = new Map(ops.map((op) => [op.resourceKey, op]));
    const open = ops.filter((op) => op.state === 'processing' || op.state === 'waitForMasterVariant');
    if (ops.length >= expected && open.length === 0) return byKey;
    if (Date.now() >= deadline) return byKey;
    await o.sleep(o.intervalMs);
  }
}

/** The whole flow for already re-validated items. The caller assigns the imported products to the store selection afterwards. */
export async function runImport(items: readonly ImportItem[], options: RunOptions): Promise<RunResult> {
  const o = { sleep: options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms))), maxWaitMs: options.maxWaitMs ?? 60_000, intervalMs: options.intervalMs ?? 2000 };
  const base = `import-${options.storeKey}-${options.stamp}`;
  const containers: string[] = [];
  const failed: { sku: string; error: string }[] = [];
  if (items.length === 0) return { imported: [], failed, containers };

  await options.transport.createContainer(base, 'product-draft');
  containers.push(base);
  for (const part of chunked(items, IMPORT_CHUNK)) await options.transport.importResources(base, 'product-draft', part.map((i) => productDraftResource(i, options.storeKey)));
  const products = await settle(options.transport, base, items.length, o);
  const okItems: ImportItem[] = [];
  for (const item of items) {
    const op = products.get(item.key);
    if (op?.state === 'imported') okItems.push(item);
    else failed.push({ sku: item.sku, error: op ? (op.errors[0] ?? (FAILED.has(op.state) ? op.state : 'not finished')) : 'not finished' });
  }

  if (okItems.length) {
    const priceContainer = `${base}-prices`;
    await options.transport.createContainer(priceContainer, 'standalone-price');
    containers.push(priceContainer);
    for (const part of chunked(okItems, IMPORT_CHUNK)) await options.transport.importResources(priceContainer, 'standalone-price', part.map((i) => standalonePriceResource(i, options.channelKey, options.currency)));
    const prices = await settle(options.transport, priceContainer, okItems.length, o);
    for (const item of okItems) {
      const op = prices.get(standalonePriceKey(item.sku, options.channelKey, options.currency ?? 'EUR'));
      if (op?.state !== 'imported') failed.push({ sku: item.sku, error: `price: ${op?.errors[0] ?? op?.state ?? 'not finished'}` });
    }
  }
  const failedSkus = new Set(failed.map((f) => f.sku));
  return { imported: items.filter((i) => !failedSkus.has(i.sku)).map((i) => i.sku), failed, containers };
}
