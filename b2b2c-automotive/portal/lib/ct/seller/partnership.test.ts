/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { complianceScore } from '@/lib/partnership/score';
import { createWFake, type WFake } from '@/lib/portal/w-fixture-root';
import { clearCatalogCaches } from './catalog-data';

let fake: WFake;
vi.mock('./catalog-root', () => ({ catalogRoot: async () => fake.root }));
vi.mock('./w-root', () => ({ wRoot: async () => fake.root }));

import { createLocalProduct } from './local-products';
import { getPartnership } from './partnership';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';
const VW = 'Volkswagen|Golf|2012|2019|1.4 TSI';
const base = { name: { 'de-DE': 'TST-W Teil', 'en-US': 'TST-W Part' }, priceCents: 1000, categoryKey: 'mau-cat-brakes', type: 'Local part' };

beforeEach(() => {
  fake = createWFake({ demo: true });
  clearCatalogCaches();
});

describe('partnership flags and score', () => {
  it('score formula: round(100 * (1 - flags / checked)); nothing checked is null', () => {
    expect(complianceScore(0, 0)).toBeNull();
    expect(complianceScore(4, 1)).toBe(75);
    expect(complianceScore(3, 1)).toBe(67);
    expect(complianceScore(2, 2)).toBe(0);
    expect(complianceScore(5, 0)).toBe(100);
  });

  it('a store without claims shows no flags and a dash score', async () => {
    const p = await getPartnership(NORTH);
    expect(p.flags).toEqual([]);
    expect(p.kpis).toEqual({ compliance: { score: null, checked: 0, flags: 0 }, claimsPending: 0 });
  });

  it('the seeded pending part SK-2002 is flagged with a View link and no claimed vehicles; the other store sees nothing', async () => {
    const p = await getPartnership(SOUTH);
    expect(p.flags).toMatchObject([{ kind: 'fitment-claim', part: { sku: 'SK-2002' }, claimedVehicles: [], fixHref: '/import?tab=local&key=mau-local-sk-2002' }]);
    expect(p.kpis).toEqual({ compliance: { score: 0, checked: 1, flags: 1 }, claimsPending: 1 });
    expect((await getPartnership(NORTH)).flags).toEqual([]);
  });

  it('a new fitment claim is flagged with its vehicles and lowers the score; an approved claim leaves the flag', async () => {
    await createLocalProduct(NORTH, { ...base, sku: 'TST-W-010', fitment: [VW] });
    await createLocalProduct(NORTH, { ...base, sku: 'TST-W-011', fitment: [VW] });
    let p = await getPartnership(NORTH);
    expect(p.flags.map((f) => [f.part.sku, f.claimedVehicles])).toEqual([['TST-W-010', [VW]], ['TST-W-011', [VW]]]);
    expect(p.kpis.compliance).toEqual({ score: 0, checked: 2, flags: 2 });
    // Malva approves one in the Merchant Center: published and review-state approved
    const approved = [...fake.state.products.values()].find((x) => x.masterVariant.sku === 'TST-W-010') as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    approved.published = true;
    approved.masterVariant.attributes.find((a: { name: string }) => a.name === 'review-state').value = 'approved';
    p = await getPartnership(NORTH);
    expect(p.flags.map((f) => f.part.sku)).toEqual(['TST-W-011']);
    expect(p.kpis.compliance).toEqual({ score: 50, checked: 2, flags: 1 });
  });

  it('rules are fitment (Enforced) and price (Informational) only: no floor, territory or content review anywhere', async () => {
    const p = await getPartnership(NORTH);
    expect(p.rules).toEqual([{ id: 'fitment', state: 'Enforced' }, { id: 'price', state: 'Informational' }]);
    expect(JSON.stringify(p)).not.toMatch(/floor|territor|content review|tailor/i);
  });
});
