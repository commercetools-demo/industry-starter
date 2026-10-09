import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePaymentProvider } from '@/lib/checkout/fake-provider';
import { StoredMethodNotFoundError } from '@/lib/checkout/payment-provider';

const rec = vi.hoisted(() => ({ listRecurring: vi.fn(), pauseRecurring: vi.fn() }));
vi.mock('@/lib/ct/recurring', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/ct/recurring')>()), ...rec }));

import { listMethods, refillsUsing, removeMethod, setDefaultMethod } from './payment-methods';

const provider = createFakePaymentProvider();
const refillOn = (id: string, methodId: string | null, state = 'Active') => ({
  id,
  recurringOrderState: state,
  cart: { obj: methodId ? { recurringPaymentConfiguration: { paymentStrategy: 'Checkout', paymentAllocations: [{ paymentMethod: { id: methodId } }] } } : {} },
});

beforeEach(() => {
  provider.reset();
  rec.listRecurring.mockReset().mockResolvedValue([]);
  rec.pauseRecurring.mockReset().mockResolvedValue({});
});

describe('payment-methods › No methods saved', () => {
  it('an account with no saved methods lists none (the page states it)', async () => {
    expect(await listMethods('c1', provider)).toEqual([]);
  });
});

describe('payment-methods › Card tokenized then listed (service)', () => {
  it('the list carries descriptors only, the default first', async () => {
    provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    provider.addStoredMethod('c1', { brand: 'Mastercard', last4: '4444', expMonth: 3, expYear: 2031, isDefault: true });
    provider.addStoredMethod('c2', { brand: 'Amex', last4: '0005' });
    const list = await listMethods('c1', provider);
    expect(list.map((m) => [m.brand, m.last4, m.isDefault])).toEqual([['Mastercard', '4444', true], ['Visa', '4242', false]]);
    expect(Object.keys(list[0] ?? {}).sort()).toEqual(['brand', 'expMonth', 'expYear', 'id', 'isDefault', 'last4']);
  });
});

describe('payment-methods: set default', () => {
  it('exactly one default afterwards, never two or none', async () => {
    const a = provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    const b = provider.addStoredMethod('c1', { brand: 'Mastercard', last4: '4444' });
    // the first saved card is the default
    expect((await listMethods('c1', provider)).filter((m) => m.isDefault).map((m) => m.id)).toEqual([a.id]);
    const after = await setDefaultMethod('c1', b.id, provider);
    expect(after.filter((m) => m.isDefault).map((m) => m.id)).toEqual([b.id]);
  });

  it('somebody else\'s method cannot be made default', async () => {
    const other = provider.addStoredMethod('c2', { brand: 'Visa', last4: '4242' });
    await expect(setDefaultMethod('c1', other.id, provider)).rejects.toBeInstanceOf(StoredMethodNotFoundError);
  });
});

describe('payment-methods › Default method removed (service)', () => {
  it('no method is marked default afterwards: the next checkout asks the buyer to choose', async () => {
    const a = provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    provider.addStoredMethod('c1', { brand: 'Mastercard', last4: '4444' });
    await setDefaultMethod('c1', a.id, provider);
    const out = await removeMethod('c1', a.id, provider, { confirm: false });
    expect(out).toMatchObject({ kind: 'removed', wasDefault: true, pausedRefills: 0 });
    if (out.kind !== 'removed') throw new Error('unreachable');
    expect(out.methods).toHaveLength(1);
    expect(out.methods.some((m) => m.isDefault)).toBe(false);
  });

  it('removing a method that is not the default says so', async () => {
    provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    const b = provider.addStoredMethod('c1', { brand: 'Mastercard', last4: '4444' });
    const out = await removeMethod('c1', b.id, provider, { confirm: false });
    expect(out).toMatchObject({ kind: 'removed', wasDefault: false });
  });

  it('somebody else\'s method cannot be removed (the same not-found as an unknown id)', async () => {
    const other = provider.addStoredMethod('c2', { brand: 'Visa', last4: '4242' });
    await expect(removeMethod('c1', other.id, provider, { confirm: true })).rejects.toBeInstanceOf(StoredMethodNotFoundError);
    expect(await listMethods('c2', provider)).toHaveLength(1);
  });
});

describe('payment-methods: an active auto-refill depends on the method', () => {
  it('the removal is refused with the number of refills until the buyer confirms; nothing is removed or paused', async () => {
    const a = provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    rec.listRecurring.mockResolvedValue([refillOn('ro1', a.id), refillOn('ro2', 'another'), refillOn('ro3', a.id, 'Canceled')]);
    expect(await refillsUsing('c1', a.id)).toEqual(['ro1']);
    expect(await removeMethod('c1', a.id, provider, { confirm: false })).toEqual({ kind: 'refill-depends', count: 1 });
    expect(await listMethods('c1', provider)).toHaveLength(1);
    expect(rec.pauseRecurring).not.toHaveBeenCalled();
  });

  it('confirmed: the method is removed and the refills that used it are paused (they could only fail)', async () => {
    const a = provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    rec.listRecurring.mockResolvedValue([refillOn('ro1', a.id), refillOn('ro2', a.id, 'Paused')]);
    const out = await removeMethod('c1', a.id, provider, { confirm: true });
    expect(out).toMatchObject({ kind: 'removed', pausedRefills: 2 });
    expect(rec.pauseRecurring.mock.calls.map((c) => c[0])).toEqual(['ro1', 'ro2']);
    expect(await listMethods('c1', provider)).toEqual([]);
  });

  it('a refill that cannot be paused does not undo the removal', async () => {
    const a = provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    rec.listRecurring.mockResolvedValue([refillOn('ro1', a.id)]);
    rec.pauseRecurring.mockRejectedValue(new Error('busy'));
    expect(await removeMethod('c1', a.id, provider, { confirm: true })).toMatchObject({ kind: 'removed', pausedRefills: 0 });
  });

  it('a refill whose cart has no payment configuration does not count', async () => {
    const a = provider.addStoredMethod('c1', { brand: 'Visa', last4: '4242' });
    rec.listRecurring.mockResolvedValue([refillOn('ro1', null)]);
    expect(await removeMethod('c1', a.id, provider, { confirm: false })).toMatchObject({ kind: 'removed' });
  });
});
