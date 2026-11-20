import { describe, expect, it } from 'vitest';
import {
  isFullyAllocated, planAllocation, type AllocationAction, type AllocationInput, type ExistingEntry, type ExistingTarget, type ShipAddress,
} from '@/lib/cart/shipping-allocation';

const SOHO = { key: 'mcf-store-nyc-soho', name: 'SoHo', addressLine: '1 Spring St', city: 'New York', postalCode: '10012', country: 'US' };
const HARLEM = { key: 'mcf-store-harlem', name: 'Harlem', addressLine: '2 Lenox Ave', city: 'New York', postalCode: '10027', country: 'US' };

const input = (over: Partial<AllocationInput> = {}): AllocationInput => ({
  country: 'US', lines: [], entries: [], addresses: [], targets: {}, stores: [SOHO, HARLEM], ...over,
});

const sohoAddress: ShipAddress = {
  key: 'collect-mcf-store-nyc-soho', country: 'US', state: 'NY', city: 'New York', postalCode: '10012', streetName: '1 Spring St',
  company: 'Malva Coffee', additionalAddressInfo: 'Collection at SoHo',
};
const deliveryAddress: ShipAddress = { key: 'delivery', country: 'US' };

const t = (addressKey: string, quantity: number): ExistingTarget => ({ addressKey, quantity, shippingMethodKey: addressKey });
const entry = (shippingKey: string, methodKey: string, address: ShipAddress): ExistingEntry => ({ shippingKey, methodKey, address });
const names = (a: AllocationAction[]) => a.map((x) => (x.action === 'setLineItemShippingDetails' ? `${x.action}:${x.lineItemId}${x.shippingDetails ? '' : ':clear'}` : x.action));

/** A cart already allocated: one delivery line (d, 2) and one SoHo line (c, 1). */
const allocated = (): AllocationInput => input({
  lines: [{ id: 'd', quantity: 2, fulfilment: 'delivery' }, { id: 'c', quantity: 1, fulfilment: 'collect', storeKey: SOHO.key }],
  entries: [entry('collect-mcf-store-nyc-soho', 'mcf-collect', sohoAddress), entry('delivery', 'mcf-ship-standard', deliveryAddress)],
  addresses: [sohoAddress, deliveryAddress],
  targets: { d: [t('delivery', 2)], c: [t('collect-mcf-store-nyc-soho', 1)] },
});

describe('planAllocation', () => {
  it('does nothing for an empty cart and for a cart that is already allocated', () => {
    expect(planAllocation(input())).toEqual([]);
    expect(planAllocation(allocated())).toEqual([]);
  });

  it('allocates a delivery-only cart: the address, the method, then the line target (country-only address)', () => {
    const plan = planAllocation(input({ lines: [{ id: 'd', quantity: 2, fulfilment: 'delivery' }] }));
    expect(plan).toEqual([
      { action: 'addItemShippingAddress', address: deliveryAddress },
      { action: 'addShippingMethod', shippingKey: 'delivery', shippingMethod: { typeId: 'shipping-method', key: 'mcf-ship-standard' }, shippingAddress: deliveryAddress },
      { action: 'setLineItemShippingDetails', lineItemId: 'd', shippingDetails: { targets: [{ addressKey: 'delivery', quantity: 2, shippingMethodKey: 'delivery' }] } },
    ]);
  });

  it('allocates a mixed bag: one entry per store, delivery and subscribe together, the store address without a name', () => {
    const plan = planAllocation(input({
      lines: [
        { id: 'a', quantity: 1, fulfilment: 'collect', storeKey: SOHO.key },
        { id: 'b', quantity: 3, fulfilment: 'subscribe' },
        { id: 'c', quantity: 1, fulfilment: 'collect', storeKey: HARLEM.key },
        { id: 'd', quantity: 2, fulfilment: 'delivery' },
      ],
    }));
    const methods = plan.filter((a) => a.action === 'addShippingMethod');
    expect(methods.map((m) => m.action === 'addShippingMethod' && [m.shippingKey, m.shippingMethod.key])).toEqual([
      ['collect-mcf-store-nyc-soho', 'mcf-collect'], ['collect-mcf-store-harlem', 'mcf-collect'], ['delivery', 'mcf-ship-standard'],
    ]);
    const soho = plan.find((a) => a.action === 'addItemShippingAddress' && a.address.key === 'collect-mcf-store-nyc-soho');
    expect(soho).toEqual({ action: 'addItemShippingAddress', address: sohoAddress });
    const targets = Object.fromEntries(plan.flatMap((a) => (a.action === 'setLineItemShippingDetails' && a.shippingDetails ? [[a.lineItemId, a.shippingDetails.targets[0]?.addressKey]] : [])));
    expect(targets).toEqual({ a: 'collect-mcf-store-nyc-soho', b: 'delivery', c: 'collect-mcf-store-harlem', d: 'delivery' });
  });

  it('puts adds before line targets and removals before adds', () => {
    const plan = planAllocation(input({
      lines: [{ id: 'd', quantity: 1, fulfilment: 'delivery' }],
      entries: [entry('collect-mcf-store-nyc-soho', 'mcf-collect', sohoAddress)],
      addresses: [sohoAddress],
      targets: { d: [t('collect-mcf-store-nyc-soho', 1)] },
    }));
    expect(names(plan)).toEqual([
      'setLineItemShippingDetails:d:clear', 'removeShippingMethod', 'removeItemShippingAddress',
      'addItemShippingAddress', 'addShippingMethod', 'setLineItemShippingDetails:d',
    ]);
  });

  it('only replaces the targets of a line whose quantity changed', () => {
    const cart = allocated();
    cart.lines = [{ id: 'd', quantity: 4, fulfilment: 'delivery' }, cart.lines[1] as never];
    expect(planAllocation(cart)).toEqual([
      { action: 'setLineItemShippingDetails', lineItemId: 'd', shippingDetails: { targets: [{ addressKey: 'delivery', quantity: 4, shippingMethodKey: 'delivery' }] } },
    ]);
  });

  it('allocates a line that has no target yet and leaves the others alone (an add to the bag)', () => {
    const cart = allocated();
    cart.lines = [...cart.lines, { id: 'n', quantity: 1, fulfilment: 'delivery' }];
    expect(names(planAllocation(cart))).toEqual(['setLineItemShippingDetails:n']);
  });

  it('removes a store entry no line uses any more, after clearing nothing (the line left the cart)', () => {
    const cart = allocated();
    cart.lines = [cart.lines[0] as never];
    expect(names(planAllocation(cart))).toEqual(['removeShippingMethod', 'removeItemShippingAddress']);
  });

  it('removes every entry of ours from an emptied cart', () => {
    const cart = allocated();
    cart.lines = [];
    expect(names(planAllocation(cart))).toEqual(['removeShippingMethod', 'removeShippingMethod', 'removeItemShippingAddress', 'removeItemShippingAddress']);
  });

  it('moves a line between stores: clears it, swaps the entries, allocates it to the new store', () => {
    const cart = allocated();
    cart.lines = [cart.lines[0] as never, { id: 'c', quantity: 1, fulfilment: 'collect', storeKey: HARLEM.key }];
    const plan = planAllocation(cart);
    expect(names(plan)).toEqual([
      'setLineItemShippingDetails:c:clear', 'removeShippingMethod', 'removeItemShippingAddress',
      'addItemShippingAddress', 'addShippingMethod', 'setLineItemShippingDetails:c',
    ]);
  });

  it('writes the pickup name and email into the collect address and replaces the entry (the address changed)', () => {
    const cart = allocated();
    cart.pickup = { name: 'Maya Lopez', email: 'maya@example.com' };
    const plan = planAllocation(cart);
    expect(names(plan)).toEqual([
      'setLineItemShippingDetails:c:clear', 'removeShippingMethod', 'removeItemShippingAddress',
      'addItemShippingAddress', 'addShippingMethod', 'setLineItemShippingDetails:c',
    ]);
    const added = plan.find((a) => a.action === 'addItemShippingAddress');
    expect(added).toMatchObject({ address: { key: 'collect-mcf-store-nyc-soho', firstName: 'Maya', lastName: 'Lopez', email: 'maya@example.com' } });
    // Running it again on the result changes nothing.
    const done = allocated();
    const withName = { ...sohoAddress, firstName: 'Maya', lastName: 'Lopez', email: 'maya@example.com' };
    done.entries = [entry('collect-mcf-store-nyc-soho', 'mcf-collect', withName), entry('delivery', 'mcf-ship-standard', deliveryAddress)];
    done.addresses = [withName, deliveryAddress];
    done.pickup = { name: 'Maya Lopez', email: 'maya@example.com' };
    expect(planAllocation(done)).toEqual([]);
  });

  it('keeps a delivery address the hosted Checkout filled in', () => {
    const cart = allocated();
    const filled: ShipAddress = { key: 'delivery', country: 'US', state: 'NY', city: 'Brooklyn', postalCode: '11201', streetName: '5 Main St', firstName: 'Maya', lastName: 'Lopez' };
    cart.entries = [entry('collect-mcf-store-nyc-soho', 'mcf-collect', sohoAddress), entry('delivery', 'mcf-ship-standard', filled)];
    cart.addresses = [sohoAddress, filled];
    expect(planAllocation(cart)).toEqual([]);
  });

  it('never removes or retargets what the hosted Checkout wrote under its own keys', () => {
    const cart = allocated();
    const theirs: ShipAddress = { key: 'checkout-addr', country: 'US' };
    cart.entries = [...cart.entries, entry('checkout-ship', 'mcf-ship-standard', theirs)];
    cart.addresses = [...cart.addresses, theirs];
    cart.lines = [...cart.lines, { id: 'x', quantity: 1, fulfilment: 'delivery' }];
    cart.targets = { ...cart.targets, x: [{ addressKey: 'checkout-addr', quantity: 1, shippingMethodKey: 'checkout-ship' }] };
    expect(planAllocation(cart)).toEqual([]);
  });

  it('sends a collect line of an unknown store to the delivery group so the cart still prices', () => {
    const plan = planAllocation(input({ lines: [{ id: 'u', quantity: 1, fulfilment: 'collect', storeKey: 'mcf-store-gone' }] }));
    expect(plan.filter((a) => a.action === 'addShippingMethod').map((a) => a.action === 'addShippingMethod' && a.shippingKey)).toEqual(['delivery']);
  });

  it('replaces an entry of ours that has another shipping method', () => {
    const cart = allocated();
    cart.entries = [entry('collect-mcf-store-nyc-soho', 'mcf-collect', sohoAddress), entry('delivery', 'mcf-other', deliveryAddress)];
    expect(names(planAllocation(cart))).toEqual([
      'setLineItemShippingDetails:d:clear', 'removeShippingMethod', 'removeItemShippingAddress', 'addItemShippingAddress', 'addShippingMethod', 'setLineItemShippingDetails:d',
    ]);
  });
});

describe('isFullyAllocated', () => {
  const lines = [{ id: 'a', quantity: 3 }];
  it('is true when the targets add up to the quantity and name an entry', () => {
    expect(isFullyAllocated(lines, { a: [t('delivery', 2), t('delivery2', 1)] }, ['delivery', 'delivery2'])).toBe(true);
  });
  it('is false for a stale quantity (the platform still says valid), a missing target and an unknown entry', () => {
    expect(isFullyAllocated(lines, { a: [t('delivery', 2)] }, ['delivery'])).toBe(false);
    expect(isFullyAllocated(lines, {}, ['delivery'])).toBe(false);
    expect(isFullyAllocated(lines, { a: [t('gone', 3)] }, ['delivery'])).toBe(false);
  });
});
