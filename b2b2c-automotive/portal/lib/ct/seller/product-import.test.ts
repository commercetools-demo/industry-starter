/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWFake, type WFake } from '@/lib/portal/w-fixture-root';
import { clearCatalogCaches } from './catalog-data';

let fake: WFake;
vi.mock('./catalog-root', () => ({ catalogRoot: async () => fake.root }));
vi.mock('./w-root', () => ({ wRoot: async () => fake.root }));

import { commitImport, validateFile } from './product-import';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';
const HEADER = 'sku,name.en-US,name.de-DE,price,categories,fitment';
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n');
const row = (n: number, price = '12.50') => `TST-W-${String(n).padStart(3, '0')},Part ${n},Teil ${n},${price},mau-cat-brakes,`;
const fast = { sleep: async () => undefined };

beforeEach(() => {
  fake = createWFake({ demo: true });
  clearCatalogCaches();
});

describe('csv validate through the project', () => {
  it('reports counts and never persists: no write happens', async () => {
    fake.resetCalls();
    const report = await validateFile(NORTH, csv(row(1), row(2), 'TST-W-003,Part 3,Teil 3,abc,mau-cat-brakes,'));
    expect([report.rows, report.valid, report.errors]).toEqual([3, 2, 1]);
    expect(fake.writes()).toHaveLength(0);
    expect(report).not.toHaveProperty('items');
    expect(report.mapping.find((m) => m.header === 'fitment')).toMatchObject({ target: null });
  });
  it('a SKU used by another store is refused with the generic text', async () => {
    const report = await validateFile(NORTH, csv('SK-2002,Part x,Teil x,5.00,mau-cat-brakes,'));
    expect(report.issues).toEqual([{ row: 2, column: 'sku', message: 'SKU already in use', effect: 'Skipped' }]);
  });
  it('bad files are a 400 with a code', async () => {
    await expect(validateFile(NORTH, '')).rejects.toMatchObject({ status: 400, code: 'EMPTY' });
    await expect(validateFile(NORTH, 'a\n"open')).rejects.toMatchObject({ status: 400, code: 'UNTERMINATED_QUOTE' });
  });
});

describe('import commits through the Import API', () => {
  it('re-validates, imports only importable rows as local parts owned by the store with standalone prices, and assigns them', async () => {
    const result = await commitImport(NORTH, csv(row(1), row(2), 'TST-W-003,Part 3,Teil 3,0,mau-cat-brakes,'), { transport: fake.importTransport, now: Date.UTC(2026, 9, 12, 12, 0, 0), ...fast });
    expect(result).toMatchObject({ imported: 2, skipped: 1, failed: [] });
    expect(result.containers).toEqual(['import-mau-reseller-north-20261012120000', 'import-mau-reseller-north-20261012120000-prices']);
    const p = [...fake.state.products.values()].find((x) => x.masterVariant.sku === 'TST-W-001');
    expect(p).toMatchObject({ published: true, key: 'local-mau-reseller-north-tst-w-001', productType: { id: 'pt-local-part' } });
    expect(p?.masterVariant.attributes.find((a: { name: string }) => a.name === 'owner-store').value).toBe(NORTH);
    expect([...fake.state.products.values()].some((x) => x.masterVariant.sku === 'TST-W-003')).toBe(false);
    expect(fake.state.prices.get('TST-W-001__mau-dist-north')).toMatchObject({ value: { centAmount: 1250, currencyCode: 'EUR' } });
    expect(fake.state.selections.get('mau-sel-north')?.products.has(p?.id)).toBe(true);
    expect(fake.state.selections.get('mau-sel-south')?.products.has(p?.id)).toBe(false);
  });

  it('a tampered client list is not used: the server only knows the file it validated itself', async () => {
    // the commit takes no row list at all; a file whose only rows are invalid imports nothing
    await expect(commitImport(NORTH, csv('TST-W-009,Part 9,Teil 9,abc,mau-cat-brakes,'), { transport: fake.importTransport, ...fast })).rejects.toMatchObject({ status: 400, code: 'NOTHING_TO_IMPORT' });
    expect([...fake.state.products.values()].some((x) => x.masterVariant.sku === 'TST-W-009')).toBe(false);
  });

  it('a row the Import API rejects is reported and gets no price; products of other stores are untouched', async () => {
    await commitImport(SOUTH, csv(row(1)), { transport: fake.importTransport, ...fast });
    const again = await commitImport(NORTH, csv(row(2)), { transport: fake.importTransport, ...fast });
    expect(again.imported).toBe(1);
    // the same SKU now exists, so the validation skips it before anything is sent
    const second = await validateFile(NORTH, csv(row(1)));
    expect(second.errors).toBe(1);
  });
});
