/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, { value: unknown; version: number }>();
const post = vi.fn(async ({ body }: { body: { key: string; value: unknown; version?: number } }) => {
  const existing = store.get(body.key);
  if (body.version !== undefined && existing?.version !== body.version) throw Object.assign(new Error('conflict'), { statusCode: 409 });
  store.set(body.key, { value: body.value, version: (existing?.version ?? 0) + 1 });
  return {};
});
vi.mock('./client', () => ({
  apiRoot: {
    customObjects: () => ({
      post: (a: { body: { key: string; value: unknown; version?: number } }) => ({ execute: () => post(a) }),
      withContainerAndKey: ({ key }: { key: string }) => ({ get: () => ({ execute: async () => ({ body: { value: store.get(key)!.value, version: store.get(key)!.version } }) }) }),
      withContainer: () => ({ get: ({ queryArgs }: { queryArgs: { where: string } }) => ({ execute: async () => {
        const [, lo, hi] = /key >= "(.+)" and key < "(.+)"/.exec(queryArgs.where)!;
        return { body: { results: [...store.entries()].filter(([k]) => k >= lo && k < hi).map(([, v]) => ({ value: v.value })) } };
      } }) }),
    }),
  },
}));
const records = await import('./intake-records');

beforeEach(() => { store.clear(); post.mockClear(); });
const base = { outputType: 'Cart' as const, fileNames: ['po.pdf'], customerId: 'c1' };

describe('intake-history › records', () => {
  it('creates a processing record before the call', async () => {
    const r = await records.createIntakeRecord('mpw-co', base);
    expect(r).toMatchObject({ status: 'processing', outputType: 'Cart', fileNames: ['po.pdf'] });
    expect(store.has(`mpw-co.${r.id}`)).toBe(true);
  });

  it('finishes with the entity reference and keeps it', async () => {
    const r = await records.createIntakeRecord('mpw-co', base);
    await records.finishIntakeRecord('mpw-co', r.id, { status: 'done', entity: { type: 'Cart', id: 'cart-1' }, warnings: ['ProductsNotFound'] });
    const [row] = await records.listIntakeRecords('mpw-co');
    expect(row).toMatchObject({ status: 'done', entity: { type: 'Cart', id: 'cart-1' }, warnings: ['ProductsNotFound'] });
    expect(row.completedAt).toBeTruthy();
  });

  it('does not overwrite a finished record', async () => {
    const r = await records.createIntakeRecord('mpw-co', base);
    await records.finishIntakeRecord('mpw-co', r.id, { status: 'done', entity: { type: 'Cart', id: 'a' }, warnings: [] });
    await records.finishIntakeRecord('mpw-co', r.id, { status: 'failed', warnings: [], errorCode: 'X' });
    expect((await records.listIntakeRecords('mpw-co'))[0].status).toBe('done');
  });

  it('lists only the unit’s own records, newest first', async () => {
    const a = await records.createIntakeRecord('mpw-co', base);
    await records.createIntakeRecord('mpw-co2', base);
    const rows = await records.listIntakeRecords('mpw-co');
    expect(rows.map((r) => r.id)).toEqual([a.id]);
  });

  it('shows a record stuck in processing as failed after the threshold', () => {
    const r = { id: 'x', status: 'processing' as const, warnings: [], createdAt: '2026-01-01T00:00:00.000Z', ...base };
    expect(records.presentRecord(r, Date.parse(r.createdAt) + 1000).status).toBe('processing');
    expect(records.presentRecord(r, Date.parse(r.createdAt) + records.STALE_AFTER_MS + 1)).toMatchObject({ status: 'failed', errorCode: 'StaleProcessing' });
  });

  it('caps the list at 50', async () => {
    for (let i = 0; i < 55; i += 1) store.set(`mpw-co.r${i}`, { value: { id: `r${i}`, status: 'done', createdAt: new Date(2026, 0, 1, 0, i).toISOString(), warnings: [], ...base }, version: 1 });
    expect(await records.listIntakeRecords('mpw-co')).toHaveLength(50);
  });

  it('refuses an unsafe business unit key', async () => {
    expect(await records.listIntakeRecords('a" or key > "')).toEqual([]);
  });
});
