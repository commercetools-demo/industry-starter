// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allServices, plumbingServices, wasteServices } from '@/components/service/test-fixtures';
import { createFakeCarts } from '../../test/fake-carts';

const world = createFakeCarts();
vi.mock('./client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (world.root as Record<string, unknown>)[p as string] }) }));
const ql = await import('./quote-list');

const [drain, boiler, pipe] = [plumbingServices[1]!, plumbingServices[3]!, plumbingServices[0]!];
const guest = { currency: 'USD', country: 'US', locale: 'en-US', storeKey: 'mpw-web' } as const;
const client = { ...guest, customerId: 'cust-1', businessUnitKey: 'mpw-co', cartId: undefined as string | undefined };

beforeEach(() => { world.carts.clear(); world.unpriceable.clear(); world.calls.length = 0; });

describe('malva-quote-list › Quote list is a zero-priced cart in the default store', () => {
  it('Add a service (guest): an anonymous in-store cart, USD, single shipping, one line of quantity 1, no price in the result', async () => {
    const r = await ql.addService({ ...guest }, drain, allServices, { frequency: 'annual', note: 'Rear yard' });
    const create = world.calls.find((c) => c.op === 'create')!;
    expect(create.api).toBe('store');
    expect(create.storeKey).toBe('mpw-web');
    expect(create.body).toMatchObject({ currency: 'USD', country: 'US', shippingMode: 'Single', anonymousId: expect.any(String), lineItems: [{ productId: drain.id, variantId: 1, quantity: 1, custom: { type: { typeId: 'type', key: 'mpw-line-service' }, fields: { frequency: 'annual', note: 'Rear yard' } } }] });
    expect(create.body).not.toHaveProperty('customerId');
    expect(r.list.count).toBe(1);
    expect(r.list.lines[0]).toMatchObject({ serviceId: drain.id, quantity: 1, frequency: 'annual', note: 'Rear yard', available: true });
    expect(JSON.stringify(r.list)).not.toMatch(/price|total|amount|centAmount/i);
  });
  it('Add a service (client): the cart is created through the associate chain in the Business Unit and store, with the locale currency', async () => {
    await ql.addService({ ...client, currency: 'EUR', country: 'DE', locale: 'de-DE' }, drain, allServices, {});
    const create = world.calls.find((c) => c.op === 'create')!;
    expect(create.api).toBe('associate');
    expect(create.body).toMatchObject({ currency: 'EUR', country: 'DE', shippingMode: 'Single', customerId: 'cust-1', businessUnit: { typeId: 'business-unit', key: 'mpw-co' }, store: { typeId: 'store', key: 'mpw-web' } });
    expect(world.calls.some((c) => c.api === 'store')).toBe(false);
  });
  it('Service without the zero price: the add fails with a generic message and the failure is logged with the service key', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    world.unpriceable.add(boiler.id);
    await expect(ql.addService({ ...guest }, boiler, allServices, {})).rejects.toMatchObject({ status: 422, message: 'We could not add this service. Please try again.' });
    expect(log).toHaveBeenCalledWith('quote list: add failed', expect.objectContaining({ service: boiler.key, code: 'MissingPriceForProduct' }));
    log.mockRestore();
  });
});

describe('malva-quote-list › Edit the list', () => {
  it('adding the same service twice returns the existing line (alreadyInList) and writes nothing', async () => {
    const first = await ql.addService({ ...guest }, drain, allServices, {});
    world.calls.length = 0;
    const again = await ql.addService({ ...guest, cartId: first.cartId }, drain, allServices, {});
    expect(again.alreadyInList).toBe(true);
    expect(again.list.count).toBe(1);
    expect(world.calls.filter((c) => c.op === 'update' || c.op === 'create')).toEqual([]);
  });
  it('Frequency options per service: only the service\'s frequencies (plus One-off, offered by the UI); an unsupported one is refused', async () => {
    const first = await ql.addService({ ...guest }, drain, allServices, {});
    expect(first.list.lines[0]!.frequencies).toEqual(['annual']);
    const s = { ...guest, cartId: first.cartId };
    const ok = await ql.updateLine(s, first.list.lines[0]!.id, { frequency: 'one-off' }, allServices);
    expect(ok.list.lines[0]!.frequency).toBe('one-off');
    await expect(ql.updateLine(s, first.list.lines[0]!.id, { frequency: 'weekly' }, allServices)).rejects.toMatchObject({ status: 400 });
    await expect(ql.addService({ ...guest }, drain, allServices, { frequency: 'weekly' })).rejects.toMatchObject({ status: 400 });
  });
  it('edits the note and clears a frequency', async () => {
    const first = await ql.addService({ ...guest }, drain, allServices, { frequency: 'annual' });
    const s = { ...guest, cartId: first.cartId };
    const id = first.list.lines[0]!.id;
    expect((await ql.updateLine(s, id, { note: ' Call first ' }, allServices)).list.lines[0]).toMatchObject({ frequency: 'annual', note: 'Call first' });
    const cleared = await ql.updateLine(s, id, { frequency: '' }, allServices);
    expect(cleared.list.lines[0]!.frequency).toBeUndefined();
    expect(cleared.list.lines[0]!.note).toBe('Call first');
  });
  it('Remove last service: the list is empty and the count is 0', async () => {
    const first = await ql.addService({ ...guest }, drain, allServices, {});
    const removed = await ql.removeLine({ ...guest, cartId: first.cartId }, first.list.lines[0]!.id, allServices);
    expect(removed.list).toMatchObject({ lines: [], count: 0 });
    await expect(ql.removeLine({ ...guest, cartId: first.cartId }, 'nope', allServices)).rejects.toMatchObject({ status: 404 });
  });
  it('Service no longer available: the line is flagged unavailable and can still be removed', async () => {
    const first = await ql.addService({ ...guest }, drain, allServices, {});
    const withoutDrain = allServices.filter((s) => s.id !== drain.id);
    const state = await ql.getQuoteList({ ...guest, cartId: first.cartId }, withoutDrain);
    expect(state.list.lines[0]).toMatchObject({ available: false, serviceId: drain.id });
    expect((await ql.removeLine({ ...guest, cartId: first.cartId }, state.list.lines[0]!.id, withoutDrain)).list.count).toBe(0);
  });
  it('a version conflict is retried once with the fresh cart', async () => {
    const first = await ql.addService({ ...guest }, drain, allServices, {});
    const cart = world.carts.get(first.cartId!)!;
    world.carts.set(cart.id, { ...cart, version: cart.version + 1 });
    const stale = (await ql.addService({ ...guest, cartId: first.cartId }, boiler, allServices, {}));
    expect(stale.list.count).toBe(2);
  });
});

describe('malva-quote-list › Quote list holds the services a visitor wants quoted', () => {
  it('Persistence: the same cart id returns the same two services', async () => {
    let r = await ql.addService({ ...guest }, drain, allServices, {});
    r = await ql.addService({ ...guest, cartId: r.cartId }, boiler, allServices, {});
    const back = await ql.getQuoteList({ ...guest, cartId: r.cartId }, allServices);
    expect(back.list.lines.map((l) => l.serviceId)).toEqual([drain.id, boiler.id]);
    expect(back.cartId).toBe(r.cartId);
  });
  it('a missing, converted or foreign cart is an empty list, never an error', async () => {
    expect((await ql.getQuoteList({ ...guest, cartId: 'gone' }, allServices)).list).toEqual({ id: null, lines: [], count: 0 });
  });
  it('Merge at sign-in: a guest list of 2 and the account list of 1 become 3 distinct lines in the Business Unit cart', async () => {
    // The account's list (a Business Unit cart with one service) and the guest cart that sign-in left outside the unit.
    const account = await ql.addService({ ...client }, pipe, allServices, {});
    let guestCart = await ql.addService({ ...guest }, drain, allServices, { frequency: 'annual' });
    guestCart = await ql.addService({ ...guest, cartId: guestCart.cartId }, boiler, allServices, {});
    const merged = await ql.getQuoteList({ ...client, cartId: guestCart.cartId }, allServices);
    expect(merged.list.count).toBe(3);
    expect(merged.list.lines.map((l) => l.serviceId).sort()).toEqual([drain.id, boiler.id, pipe.id].sort());
    expect(merged.cartId).toBe(account.cartId);
    expect(merged.list.lines.find((l) => l.serviceId === drain.id)!.frequency).toBe('annual');
    // The guest cart was deleted once it was merged.
    expect(world.carts.has(guestCart.cartId!)).toBe(false);
  });
});

describe('malva-locale-routing › Quote list on switch', () => {
  it('a USD list is started again in EUR with the same services, frequencies and notes, and the old cart is deleted', async () => {
    let r = await ql.addService({ ...guest }, drain, allServices, { frequency: 'annual', note: 'Rear yard' });
    r = await ql.addService({ ...guest, cartId: r.cartId }, wasteServices[0]!, allServices, {});
    const rebuilt = await ql.rebuildQuoteList({ ...guest, currency: 'EUR', country: 'DE', locale: 'de-DE', cartId: r.cartId });
    expect(rebuilt.rebuilt).toBe(true);
    expect(rebuilt.cartId).not.toBe(r.cartId);
    const fresh = world.carts.get(rebuilt.cartId!)!;
    expect(fresh.totalPrice.currencyCode).toBe('EUR');
    expect(fresh.lineItems.map((l: { productId: string }) => l.productId)).toEqual([drain.id, wasteServices[0]!.id]);
    expect(fresh.lineItems[0]!.custom?.fields).toEqual({ frequency: 'annual', note: 'Rear yard' });
    expect(world.carts.has(r.cartId!)).toBe(false);
  });
  it('a list that already matches the currency is left alone', async () => {
    const r = await ql.addService({ ...guest }, drain, allServices, {});
    const same = await ql.rebuildQuoteList({ ...guest, cartId: r.cartId });
    expect(same).toEqual({ cartId: r.cartId, rebuilt: false });
  });
});
