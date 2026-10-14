import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyConfirmed, plan } from '@/lib/portal/copilot';
import { sessionFor } from '@/lib/authz/test-helpers';

const svc = vi.hoisted(() => ({ list: vi.fn(), set: vi.fn(), authorize: vi.fn(async () => undefined) }));
vi.mock('@/lib/ct/seller/discounts', () => ({ listDiscounts: svc.list, setDiscountActive: svc.set }));
vi.mock('@/lib/authz/authorize-store', () => ({ authorizeStore: svc.authorize }));

import { LOCKED_MESSAGE } from './copilot-discounts';

const admin = { roles: ['admin' as const], ctPermissions: [] };
const buyer = { roles: ['buyer' as const], ctPermissions: [] };
const d = (id: string, name: string, funded: 'malva' | 'store' = 'store') => ({ id, name: { 'en-US': name }, funded });

beforeEach(() => {
  svc.list.mockReset();
  svc.set.mockReset();
  svc.authorize.mockClear();
  svc.list.mockImplementation(async (_s: string, kind: string) => (kind === 'product' ? [d('d1', 'Brake season promo'), d('m1', 'Malva spring', 'malva')] : [d('c1', 'Winter cart')]));
});

describe('copilot set-discount-active', () => {
  it('"Pause the Brake season promo" asks first, with the exact change, and changes nothing', () => {
    const result = plan('Pause the Brake season promo', sessionFor('adminA'), admin);
    expect(result).toMatchObject({ kind: 'confirm', actionId: 'set-discount-active', summary: "Set 'Brake season promo' to inactive" });
    expect(svc.set).not.toHaveBeenCalled();
    expect(svc.list).not.toHaveBeenCalled();
  });

  it('"Turn on ..." proposes active', () => {
    expect(plan('turn on the Winter cart', sessionFor('adminA'), admin)).toMatchObject({ summary: "Set 'Winter cart' to active" });
  });

  it('a buyer is refused at plan time', () => {
    expect(plan('Pause the Brake season promo', sessionFor('buyerA'), buyer)).toMatchObject({ kind: 'answer' });
  });

  it('Confirm sets it inactive in the signed-in store only, after authorizeStore', async () => {
    const session = sessionFor('adminA');
    const result = await applyConfirmed('set-discount-active', { name: 'Brake season promo', active: 'false' }, session, admin);
    expect(result.ok).toBe(true);
    expect(svc.authorize).toHaveBeenCalledWith(session, 'store-a', 'discount.edit');
    expect(svc.set).toHaveBeenCalledWith('store-a', 'product', 'd1', false);
  });

  it('a Malva-funded discount is refused with the locked message', async () => {
    const result = await applyConfirmed('set-discount-active', { name: 'Malva spring', active: 'false' }, sessionFor('adminA'), admin);
    expect(result).toEqual({ ok: false, message: LOCKED_MESSAGE });
    expect(svc.set).not.toHaveBeenCalled();
  });

  it('an ambiguous name lists the matches and changes nothing', async () => {
    svc.list.mockImplementation(async (_s: string, kind: string) => [d(`${kind}-1`, 'Spring sale')]);
    const result = await applyConfirmed('set-discount-active', { name: 'Spring sale', active: 'false' }, sessionFor('adminA'), admin);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Spring sale (product)');
    expect(result.message).toContain('Spring sale (cart)');
    expect(svc.set).not.toHaveBeenCalled();
  });

  it('an unknown name changes nothing, and a buyer cannot apply', async () => {
    expect((await applyConfirmed('set-discount-active', { name: 'Nope', active: 'false' }, sessionFor('adminA'), admin)).ok).toBe(false);
    expect((await applyConfirmed('set-discount-active', { name: 'Brake season promo', active: 'false' }, sessionFor('buyerA'), buyer)).ok).toBe(false);
    expect(svc.set).not.toHaveBeenCalled();
  });
});
