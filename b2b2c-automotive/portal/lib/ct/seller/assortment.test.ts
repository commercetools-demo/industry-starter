import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeCommercetools, type FakeCommercetools } from '@/lib/portal/catalog-fixture-root';
import { clearCatalogCaches } from './catalog-data';

let fake: FakeCommercetools;
vi.mock('./catalog-root', () => ({ catalogRoot: async () => fake.root }));

import { assortmentImpact, getChain, isAssigned, listAssortment } from './assortment';
import { assignProducts, onAssortmentChanged, reconcileAssortment, withdrawProducts } from './assortment-write';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';
const query = { offset: 0, limit: 100 } as const;

beforeEach(() => {
  fake = createFakeCommercetools();
  clearCatalogCaches();
  onAssortmentChanged.length = 0;
});

const stateOf = async (store: string, sku: string) => (await listAssortment(store, query)).rows.find((r) => r.sku === sku)?.state;

describe('listAssortment', () => {
  it('states from the seed shape: MLV-HL-56002 blocked upstream, MLV-BP-41099 pre-release, MLV-BP-41003 withdrawn by reseller in north, SK-2002 pending review in south, KW-1001 local in north only', async () => {
    expect(await stateOf(NORTH, 'MLV-HL-56002')).toBe('blocked-upstream');
    expect(await stateOf(NORTH, 'MLV-BP-41099')).toBe('pre-release');
    expect(await stateOf(NORTH, 'MLV-BP-41003')).toBe('withdrawn');
    expect(await stateOf(SOUTH, 'SK-2002')).toBe('pending-review');
    expect(await stateOf(NORTH, 'KW-1001')).toBe('local');
    expect(await stateOf(NORTH, 'MLV-BP-41001')).toBe('inherited');
    expect(await stateOf(NORTH, 'MLV-EX-52001')).toBe('available');
    expect(await stateOf(SOUTH, 'MLV-BP-41003')).toBe('inherited');
  });

  it('blocked upstream rows carry the reason and who blocked it; withdrawn rows carry the stored reason', async () => {
    const rows = (await listAssortment(NORTH, query)).rows;
    expect(rows.find((r) => r.sku === 'MLV-HL-56002')).toMatchObject({ reason: 'No type approval for road use in Germany', reasonBy: 'Malva DACH' });
    expect(rows.find((r) => r.sku === 'MLV-BP-41003')?.reason).toBe('Quality policy: premium brake parts only');
  });

  it('pre-release part is never shown as 0', async () => {
    const row = (await listAssortment(NORTH, query)).rows.find((r) => r.sku === 'MLV-BP-41099');
    expect(row?.listPrice).toBeNull();
    const priced = (await listAssortment(NORTH, query)).rows.find((r) => r.sku === 'MLV-BP-41001');
    expect(priced?.listPrice).toEqual({ centAmount: 9450, currencyCode: 'EUR' });
  });

  it("local part of another store never appears in this store's list", async () => {
    const north = (await listAssortment(NORTH, query)).rows.map((r) => r.sku);
    const south = (await listAssortment(SOUTH, query)).rows.map((r) => r.sku);
    expect(north).toContain('KW-1001');
    expect(north).not.toContain('SK-2002');
    expect(south).toContain('SK-2002');
    expect(south).not.toContain('KW-1001');
  });

  it('counts "n of total master products assigned" and filters by state, text and category', async () => {
    const all = await listAssortment(NORTH, query);
    expect(all.totalMaster).toBe(10);
    expect(all.assigned).toBe(6);
    expect((await listAssortment(NORTH, { ...query, state: 'blocked' })).rows.map((r) => r.sku)).toEqual(['MLV-HL-56002']);
    expect((await listAssortment(NORTH, { ...query, state: 'assigned' })).rows.every((r) => ['inherited', 'local'].includes(r.state))).toBe(true);
    expect((await listAssortment(NORTH, { ...query, state: 'available' })).rows.map((r) => r.sku).sort()).toEqual(['MLV-BP-41003', 'MLV-BP-41099', 'MLV-EX-52001']);
    expect((await listAssortment(NORTH, { ...query, text: 'muffler' })).rows.map((r) => r.sku)).toEqual(['MLV-EX-52001']);
    expect((await listAssortment(NORTH, { ...query, categoryId: 'cat-filters' })).rows.map((r) => r.sku)).toEqual(['MLV-AF-45001', 'MLV-OF-44001', 'MLV-OF-44002']);
    expect((await listAssortment(NORTH, { offset: 2, limit: 3 })).rows).toHaveLength(3);
  });

  it('chain counts: master pool, approved (master minus blocked), the store selection, branch channels', async () => {
    expect(await getChain(NORTH)).toEqual({ masterCount: 10, approvedCount: 9, resellerCount: 7, branchCount: 2 });
  });
});

describe('isAssigned', () => {
  it("isAssigned is true for an assigned SKU, false for withdrawn, available, blocked, unknown and other stores' parts", async () => {
    expect(await isAssigned(NORTH, 'MLV-BP-41001')).toBe(true);
    expect(await isAssigned(NORTH, 'KW-1001')).toBe(true);
    expect(await isAssigned(NORTH, 'MLV-BP-41003')).toBe(false); // withdrawn
    expect(await isAssigned(NORTH, 'MLV-EX-52001')).toBe(false); // available
    expect(await isAssigned(NORTH, 'MLV-HL-56002')).toBe(false); // blocked
    expect(await isAssigned(NORTH, 'NOPE-1')).toBe(false);
    expect(await isAssigned(NORTH, 'SK-2002')).toBe(false); // another store's part
    expect(await isAssigned(SOUTH, 'KW-1001')).toBe(false);
  });
});

describe('assign', () => {
  it('blocked upstream cannot be assigned (409) and nothing is written', async () => {
    const id = fake.ids.sku('MLV-HL-56002');
    await expect(assignProducts(NORTH, [id])).rejects.toMatchObject({ status: 409, code: 'BLOCKED_UPSTREAM' });
    expect(fake.writes()).toHaveLength(0);
  });

  it('a part outside the master pool that is not the store own item is refused; the own approved item is accepted; a pending one is refused', async () => {
    await expect(assignProducts(NORTH, [fake.ids.sku('SK-2002')])).rejects.toMatchObject({ code: 'BLOCKED_UPSTREAM' });
    await expect(assignProducts(SOUTH, [fake.ids.sku('SK-2002')])).rejects.toMatchObject({ code: 'BLOCKED_UPSTREAM' }); // pending review
    await expect(assignProducts(NORTH, ['unknown-id'])).rejects.toMatchObject({ code: 'BLOCKED_UPSTREAM' });
    expect(fake.writes()).toHaveLength(0);
    await withdrawProducts(NORTH, [fake.ids.sku('KW-1001')], { confirm: true, expectedCount: 1 });
    await expect(assignProducts(NORTH, [fake.ids.sku('KW-1001')])).resolves.toEqual({ added: 1 });
  });

  it('assign adds the product and clears a withdrawn record (reinstate); an already assigned part is a no-op', async () => {
    const id = fake.ids.sku('MLV-BP-41003');
    await expect(assignProducts(NORTH, [id])).resolves.toEqual({ added: 1 });
    expect(fake.selectionSkus('mau-sel-north')).toContain('MLV-BP-41003');
    expect(fake.state.objects.get(`mau-assortment/${NORTH}`)?.value.withdrawnByReseller).toEqual([]);
    fake.resetCalls();
    await expect(assignProducts(NORTH, [id])).resolves.toEqual({ added: 0 });
    expect(fake.writes()).toHaveLength(0);
  });

  it('assign of a pre-release part is allowed', async () => {
    await expect(assignProducts(NORTH, [fake.ids.sku('MLV-BP-41099')])).resolves.toEqual({ added: 1 });
  });
});

describe('withdraw', () => {
  it('withdraw without confirm or with wrong expectedCount is 409 and writes nothing', async () => {
    const id = fake.ids.sku('MLV-BP-41001');
    await expect(withdrawProducts(NORTH, [id], { confirm: false, expectedCount: 1 })).rejects.toMatchObject({ status: 409, code: 'CONFIRMATION_REQUIRED', details: { count: 1, branches: 2, openCartCount: 2 } });
    await expect(withdrawProducts(NORTH, [id], { confirm: true, expectedCount: 5 })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
    expect(fake.writes()).toHaveLength(0);
  });

  it('withdraw removes from selection and records withdrawn; reinstate adds back and clears the record; onAssortmentChanged hooks run', async () => {
    const hook = vi.fn(async () => undefined);
    onAssortmentChanged.push(hook);
    const id = fake.ids.sku('MLV-BP-41001');
    await expect(withdrawProducts(NORTH, [id], { confirm: true, expectedCount: 1 })).resolves.toEqual({ removed: 1 });
    expect(fake.selectionSkus('mau-sel-north')).not.toContain('MLV-BP-41001');
    expect(fake.selectionSkus('mau-sel-south')).toContain('MLV-BP-41001'); // the other store is untouched
    const object = fake.state.objects.get(`mau-assortment/${NORTH}`)?.value;
    expect(object.withdrawnByReseller.map((w: { sku: string }) => w.sku)).toEqual(['MLV-BP-41003', 'MLV-BP-41001']);
    expect(object.blockedUpstream).toHaveLength(1); // every other field is kept
    expect(object.preRelease).toEqual(['MLV-BP-41099']);
    expect(await stateOf(NORTH, 'MLV-BP-41001')).toBe('withdrawn');
    expect(hook).toHaveBeenCalledWith(NORTH);

    await assignProducts(NORTH, [id]);
    expect(fake.selectionSkus('mau-sel-north')).toContain('MLV-BP-41001');
    expect(fake.state.objects.get(`mau-assortment/${NORTH}`)?.value.withdrawnByReseller.map((w: { sku: string }) => w.sku)).toEqual(['MLV-BP-41003']);
    expect(hook).toHaveBeenCalledTimes(2);
    expect(await stateOf(NORTH, 'MLV-BP-41001')).toBe('inherited');
  });

  it('never writes the master selection', async () => {
    await withdrawProducts(NORTH, [fake.ids.sku('MLV-BP-41001')], { confirm: true, expectedCount: 1 });
    await assignProducts(NORTH, [fake.ids.sku('MLV-BP-41001')]);
    expect(fake.state.selections.get('mau-sel-malva-master')?.version).toBe(1);
  });

  it('409 ConcurrentModification retries with the latest version', async () => {
    fake.conflictOnce('selection.update');
    const id = fake.ids.sku('MLV-BD-42001');
    await withdrawProducts(NORTH, [id], { confirm: true, expectedCount: 1 });
    const updates = fake.callsOf('selection.update').map((c) => (c.args as { version: number }).version);
    expect(updates).toHaveLength(2);
    expect(updates[1]).toBeGreaterThan(updates[0]); // the retry sent the latest version, not the failed one
    expect(fake.selectionSkus('mau-sel-north')).not.toContain('MLV-BD-42001');
  });

  it('retries the state object on a version conflict as well', async () => {
    fake.conflictOnce('object.write');
    await withdrawProducts(NORTH, [fake.ids.sku('MLV-BD-42001')], { confirm: true, expectedCount: 1 });
    expect(fake.callsOf('object.write')).toHaveLength(2);
    expect(fake.state.objects.get(`mau-assortment/${NORTH}`)?.value.withdrawnByReseller.map((w: { sku: string }) => w.sku)).toContain('MLV-BD-42001');
  });

  it('bulk of 40 products reports count and open carts before applying', async () => {
    const ids = Array.from({ length: 40 }, (_, i) => (i === 0 ? fake.ids.sku('MLV-BP-41001') : `missing-${i}`));
    await expect(assortmentImpact(NORTH, ids)).resolves.toEqual({ count: 40, openCartCount: 2, branches: 2 });
    await expect(withdrawProducts(NORTH, ids, { confirm: false, expectedCount: 40 })).rejects.toMatchObject({ details: { count: 40, openCartCount: 2 } });
    expect(fake.writes()).toHaveLength(0);
  });

});

describe('reconcileAssortment', () => {
  it('reconcileAssortment removes parts no longer approved upstream', async () => {
    fake.state.selections.get('mau-sel-north')?.products.add(fake.ids.sku('MLV-HL-56002')); // blocked part slipped in
    clearCatalogCaches();
    const result = await reconcileAssortment(NORTH);
    expect(result.removed).toEqual(['MLV-HL-56002']);
    expect(fake.selectionSkus('mau-sel-north')).not.toContain('MLV-HL-56002');
    expect(fake.selectionSkus('mau-sel-north')).toContain('KW-1001'); // own item stays
  });

  it('a part that left the master pool is removed, the store own items are not', async () => {
    fake.state.selections.get('mau-sel-malva-master')?.products.delete(fake.ids.sku('MLV-BD-42001'));
    fake.state.selections.get('mau-sel-malva-master')!.version += 1;
    clearCatalogCaches();
    expect((await reconcileAssortment(NORTH)).removed).toEqual(['MLV-BD-42001']);
  });

  it('does nothing when the selection is clean', async () => {
    expect(await reconcileAssortment(NORTH)).toEqual({ removed: [] });
    expect(fake.writes()).toHaveLength(0);
  });
});
