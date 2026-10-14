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

import { createLocalProduct, listLocalProducts, listVehicleOptions } from './local-products';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';
const VW = 'Volkswagen|Golf|2012|2019|1.4 TSI';
const base = { name: { 'de-DE': 'TST-W Bremsenreiniger', 'en-US': 'TST-W Brake cleaner' }, sku: 'TST-W-001', priceCents: 1290, categoryKey: 'mau-cat-brakes', type: 'Local part', brandName: 'TST-W Brand' };

beforeEach(() => {
  fake = createWFake({ demo: true });
  clearCatalogCaches();
});

const product = (sku: string) => [...fake.state.products.values()].find((p) => p.masterVariant.sku === sku);
const inSelection = (id: string) => fake.state.selections.get('mau-sel-north')?.products.has(id) as boolean;

describe('local sku duplicate', () => {
  it('a SKU that exists anywhere in the project is a 409 with field sku and a generic text', async () => {
    for (const sku of ['SK-2002', 'KW-1001']) {
      await expect(createLocalProduct(NORTH, { ...base, sku })).rejects.toMatchObject({ status: 409, code: 'SKU_IN_USE', message: 'SKU already in use', details: { field: 'sku' } });
    }
    await createLocalProduct(NORTH, base);
    await expect(createLocalProduct(SOUTH, base)).rejects.toMatchObject({ status: 409, details: { field: 'sku' } });
  });
});

describe('local fitment claim unpublished', () => {
  it('without a claim: published at once, approved, owned by the store, standalone price, in the store selection', async () => {
    const result = await createLocalProduct(NORTH, base);
    expect(result).toMatchObject({ status: 'live', key: 'local-mau-reseller-north-tst-w-001' });
    const p = product('TST-W-001');
    expect(p).toMatchObject({ published: true, productType: { id: 'pt-local-part' } });
    const attrs = Object.fromEntries(p?.masterVariant.attributes.map((a: { name: string; value: unknown }) => [a.name, a.value]));
    expect(attrs).toEqual({ 'part-number': 'TST-W-001', 'brand-name': 'TST-W Brand', 'owner-store': NORTH, 'review-state': 'approved' });
    expect(p?.masterVariant.prices).toBeUndefined();
    expect([...fake.state.prices.values()].filter((x) => x.sku === 'TST-W-001')).toMatchObject([{ key: 'TST-W-001__mau-dist-north', value: { centAmount: 1290 } }]);
    expect(inSelection(p?.id)).toBe(true);
  });

  it('with a claim: unpublished, pending, in no selection, claimed vehicles only in the review record, listed as pending review', async () => {
    const result = await createLocalProduct(NORTH, { ...base, sku: 'TST-W-002', fitment: [VW] });
    expect(result.status).toBe('pending');
    const p = product('TST-W-002');
    expect(p?.published).toBe(false);
    expect(p?.masterVariant.attributes.find((a: { name: string }) => a.name === 'review-state').value).toBe('pending');
    expect(JSON.stringify(p)).not.toContain('Volkswagen'); // no fitment attribute on the product
    for (const sel of fake.state.selections.values()) expect(sel.products.has(p?.id)).toBe(false);
    expect(fake.state.objects.get(`malva-local-review/${NORTH}--${result.key}`)?.value).toMatchObject({ state: 'pending', storeKey: NORTH, claimedVehicles: [VW] });
    expect(fake.state.objects.get(`mau-assortment/${NORTH}`)?.value.pendingReview).toContain('TST-W-002');
    expect([...fake.state.prices.values()].some((x) => x.sku === 'TST-W-002' && x.value.centAmount === 1290)).toBe(true);
  });

  it('a claim must name vehicles from the vehicle table', async () => {
    await expect(createLocalProduct(NORTH, { ...base, fitment: ['Nonsense|Car|1|2|x'] })).rejects.toMatchObject({ status: 400, details: { field: 'fitment' } });
    expect((await listVehicleOptions()).map((v) => v.fitmentKey)).toContain(VW);
  });

  it('validation: price 0 or negative, bad SKU, MLV- prefix, unknown category, name length, Bundle type: 400 and nothing is written', async () => {
    fake.resetCalls();
    for (const bad of [{ priceCents: 0 }, { priceCents: -5 }, { sku: 'ab' }, { sku: 'MLV-X-1' }, { categoryKey: 'nope' }, { name: { 'de-DE': 'x', 'en-US': 'ok name' } }, { type: 'Bundle' }]) {
      await expect(createLocalProduct(NORTH, { ...base, ...bad })).rejects.toMatchObject({ status: 400 });
    }
    expect(fake.writes()).toHaveLength(0);
  });

  it('the list shows Live, Awaiting review and the claimed vehicles for the store only', async () => {
    await createLocalProduct(NORTH, base);
    await createLocalProduct(NORTH, { ...base, sku: 'TST-W-002', fitment: [VW] });
    const rows = await listLocalProducts(NORTH);
    expect(rows.filter((r) => r.sku.startsWith('TST-W')).map((r) => [r.sku, r.status, r.priceCents, r.claimedVehicles])).toEqual([
      ['TST-W-001', 'Live', 1290, []],
      ['TST-W-002', 'Awaiting review', 1290, [VW]],
    ]);
    expect(rows.map((r) => r.sku)).toContain('KW-1001');
    expect((await listLocalProducts(SOUTH)).map((r) => r.sku)).toEqual(['SK-2002']);
  });
});
