import { describe, expect, it } from 'vitest';
import {
  buildFulfilmentActions, buildSingleGroupActions, collectAddress, planGroups, shippingKeyOf, splitPickupName, splitPlan,
  type FulfilmentGroup,
} from './fulfilment-plan';
import { MIXED_STRATEGY } from './strategy';

const store = (key: string) => ({ key, id: `id-${key}`, name: `Store ${key}`, addressLine: '148 Prince Street', city: 'New York', collectionMinutes: 20 });
const line = (id: string, fulfilment: 'collect' | 'delivery' | 'subscribe', storeKey?: string) => ({
  id, fulfilment,
  groupKey: (fulfilment === 'collect' ? `collect:${storeKey}` : fulfilment) as `collect:${string}` | 'delivery' | 'subscribe',
  ...(storeKey ? { store: store(storeKey) } : {}),
});

describe('planGroups', () => {
  it('Mixed bag makes a ship group and a collect group', () => {
    const groups = planGroups({ country: 'US', lines: [line('a', 'delivery'), line('b', 'collect', 'soho')] });
    expect(groups.map((g) => [g.key, g.kind])).toEqual([['collect:soho', 'collect'], ['delivery', 'delivery']]);
  });
  it('Every line belongs to exactly one cluster', () => {
    const lines = [line('a', 'delivery'), line('b', 'collect', 'soho'), line('c', 'subscribe'), line('d', 'collect', 'soho')];
    const all = planGroups({ country: 'US', lines }).flatMap((g) => g.lineIds);
    expect([...all].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
  it('Subscribe lines join the ship group', () => {
    const groups = planGroups({ country: 'US', lines: [line('a', 'delivery'), line('c', 'subscribe')] });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.lineIds).toEqual(['a', 'c']);
  });
  it('Lines from two stores make two collect groups', () => {
    const groups = planGroups({ country: 'US', lines: [line('a', 'collect', 'soho'), line('b', 'collect', 'chelsea')] });
    expect(groups.map((g) => g.storeKey)).toEqual(['soho', 'chelsea']);
  });
  it('Canada bag has no collect group', () => {
    const groups = planGroups({ country: 'CA', lines: [line('a', 'delivery'), line('x', 'collect', 'soho')] });
    expect(groups.map((g) => g.kind)).toEqual(['delivery']);
  });
  it('Split plan creates one Single cart per group', () => {
    const groups = planGroups({ country: 'US', lines: [line('a', 'delivery'), line('b', 'collect', 'soho')] });
    const plan = splitPlan(groups);
    expect(plan.map((p) => [p.part, p.group.key, p.applyCodes])).toEqual([[0, 'collect:soho', true], [1, 'delivery', false]]);
  });
});

describe('collect address', () => {
  const addr = collectAddress({ name: 'SoHo', addressLine: '148 Prince Street', city: 'New York', postalCode: '10012', country: 'US' }, 'Maya Lopez', 'm@example.com');
  it('Collect group address is the store with the pickup name', () => {
    expect(addr).toMatchObject({ firstName: 'Maya', lastName: 'Lopez', streetName: '148 Prince Street', city: 'New York', postalCode: '10012', country: 'US', state: 'NY', company: 'Malva Coffee', additionalAddressInfo: 'Collection at SoHo', email: 'm@example.com' });
  });
  it('splits a single-word name into the last name', () => {
    expect(splitPickupName('Cher')).toEqual({ firstName: '', lastName: 'Cher' });
  });
  it('keys have no colon', () => {
    expect(shippingKeyOf('collect:mcf-store-nyc-soho')).toBe('collect-mcf-store-nyc-soho');
  });
});

describe('actions', () => {
  const group: FulfilmentGroup = { key: 'collect:soho', kind: 'collect', storeKey: 'soho', lineIds: ['b', 'd'] };
  const address = collectAddress({ name: 'SoHo', addressLine: '148 Prince Street', city: 'New York', postalCode: '10012', country: 'US' }, 'Maya Lopez');
  const input = {
    existing: { shippingKeys: ['old-ship'], addressKeys: ['old-addr'], linesWithDetails: ['b'] },
    collect: [{ group, address, lines: [{ lineId: 'b', quantity: 2 }, { lineId: 'd', quantity: 1 }] }],
  };
  it('Multiple actions run in a safe order', () => {
    const order = buildFulfilmentActions(input).map((a) => a.action);
    expect(order).toEqual([
      'setLineItemShippingDetails', 'removeShippingMethod', 'removeItemShippingAddress',
      'addItemShippingAddress', 'addShippingMethod', 'setLineItemShippingDetails', 'setLineItemShippingDetails',
    ]);
  });
  it('Existing shipping entries are removed before new ones are added', () => {
    const actions = buildFulfilmentActions(input);
    const firstAdd = actions.findIndex((a) => a.action === 'addItemShippingAddress');
    expect(actions.findIndex((a) => a.action === 'removeShippingMethod')).toBeLessThan(firstAdd);
    expect(actions.findIndex((a) => a.action === 'removeItemShippingAddress')).toBeLessThan(firstAdd);
  });
  it('Every collect line quantity is allocated to a target', () => {
    const targets = buildFulfilmentActions(input).flatMap((a) => (a.action === 'setLineItemShippingDetails' && a.shippingDetails ? [a] : []));
    expect(targets.map((t) => [t.lineItemId, t.shippingDetails?.targets[0]?.quantity, t.shippingDetails?.targets[0]?.addressKey])).toEqual([
      ['b', 2, 'collect-soho'], ['d', 1, 'collect-soho'],
    ]);
  });
  it('Single group uses setShippingMethod', () => {
    expect(buildSingleGroupActions(group, address).map((a) => a.action)).toEqual(['setShippingAddress', 'setShippingMethod']);
  });
  it('Collect only uses mcf-collect', () => {
    const m = buildSingleGroupActions(group, address).find((a) => a.action === 'setShippingMethod');
    expect(m).toMatchObject({ shippingMethod: { key: 'mcf-collect' } });
  });
  it('a delivery group is left to the hosted flow', () => {
    expect(buildSingleGroupActions({ key: 'delivery', kind: 'delivery', storeKey: null, lineIds: ['a'] }, null)).toEqual([]);
  });
  it('the provisional strategy is complete-per-group', () => {
    expect(MIXED_STRATEGY).toBe('complete-per-group');
  });
});
