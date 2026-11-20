import { describe, expect, it } from 'vitest';
import { collectAddress, planGroups, shippingKeyOf, splitPickupName, splitPlan } from './fulfilment-plan';
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

describe('strategy', () => {
  it('the mixed bag is paid as one Multiple cart (D-062); complete-per-group is the fallback constant', () => {
    expect(MIXED_STRATEGY).toBe('complete-multiple');
  });
});
