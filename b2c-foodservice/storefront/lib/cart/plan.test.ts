import { describe, expect, it } from 'vitest';
import { groupKeyOf, groupLines, planFulfilmentSwitch, planStoreChange, type PlanLine } from '@/lib/cart/plan';
import type { CartLineStore } from '@/lib/types';

const line = (id: string, sku: string, quantity: number, over: Partial<PlanLine> = {}): PlanLine => ({
  id, sku, quantity, fulfilment: 'delivery', subscribe: false, ...over,
});
const collect = (id: string, sku: string, quantity: number, channelId: string): PlanLine =>
  line(id, sku, quantity, { fulfilment: 'collect', channelId });
const sub = (id: string, sku: string): PlanLine => line(id, sku, 1, { fulfilment: 'subscribe', subscribe: true });

const store = (key: string): CartLineStore => ({ key, id: `ch-${key}`, name: key, addressLine: '1 Main', city: 'New York', collectionMinutes: 15 });

describe('planFulfilmentSwitch', () => {
  it('Switch to ship moves the line to the ship group', () => {
    const plan = planFulfilmentSwitch([collect('a', 'S1', 2, 'ch-1')], 'a', { fulfilment: 'delivery' });
    expect(plan).toEqual({ kind: 'ops', ops: [{ kind: 'set', lineId: 'a', fulfilment: 'delivery', channelId: null }], resultingQuantity: 2 });
  });

  it('Merge combines quantities with an identical ship line', () => {
    const plan = planFulfilmentSwitch([collect('a', 'S1', 2, 'ch-1'), line('b', 'S1', 3)], 'a', { fulfilment: 'delivery' });
    expect(plan).toEqual({ kind: 'ops', ops: [{ kind: 'merge', keepId: 'b', quantity: 5, removeId: 'a' }], resultingQuantity: 5 });
  });

  it('collect twin needs the same store', () => {
    const lines = [line('a', 'S1', 1), collect('b', 'S1', 4, 'ch-2')];
    const same = planFulfilmentSwitch(lines, 'a', { fulfilment: 'collect', channelId: 'ch-2' });
    expect(same).toMatchObject({ ops: [{ kind: 'merge', keepId: 'b', quantity: 5, removeId: 'a' }] });
    const other = planFulfilmentSwitch(lines, 'a', { fulfilment: 'collect', channelId: 'ch-1' });
    expect(other).toMatchObject({ ops: [{ kind: 'set', lineId: 'a', fulfilment: 'collect', channelId: 'ch-1' }] });
  });

  it('subscribe lines are not switchable', () => {
    expect(planFulfilmentSwitch([sub('s', 'S1')], 's', { fulfilment: 'delivery' })).toEqual({ kind: 'reject', reason: 'subscribe_line_not_switchable' });
  });

  it('unknown line is rejected', () => {
    expect(planFulfilmentSwitch([], 'x', { fulfilment: 'delivery' })).toEqual({ kind: 'reject', reason: 'line_not_found' });
  });

  it('ship twin and collect twin are never merged across fulfilment', () => {
    // A subscribe line of the same SKU is never a twin, and a collect line is not a twin of a delivery target.
    const lines = [collect('a', 'S1', 1, 'ch-1'), sub('s', 'S1'), collect('c', 'S1', 2, 'ch-2')];
    const plan = planFulfilmentSwitch(lines, 'a', { fulfilment: 'delivery' });
    expect(plan).toMatchObject({ ops: [{ kind: 'set', lineId: 'a' }] });
  });

  it('a line already in the target state is a no-op', () => {
    expect(planFulfilmentSwitch([line('a', 'S1', 1)], 'a', { fulfilment: 'delivery' })).toEqual({ kind: 'noop' });
    expect(planFulfilmentSwitch([collect('a', 'S1', 1, 'ch-1')], 'a', { fulfilment: 'collect', channelId: 'ch-1' })).toEqual({ kind: 'noop' });
  });
});

describe('planStoreChange', () => {
  it('change store moves collect lines and merges duplicates', () => {
    const lines = [collect('a', 'S1', 1, 'ch-1'), collect('b', 'S2', 2, 'ch-1'), collect('c', 'S1', 5, 'ch-2'), line('d', 'S3', 1)];
    expect(planStoreChange(lines, 'ch-2')).toEqual([
      { kind: 'merge', keepId: 'c', quantity: 6, removeId: 'a' },
      { kind: 'set', lineId: 'b', fulfilment: 'collect', channelId: 'ch-2' },
    ]);
  });

  it('two moved lines of one SKU merge into the first moved line', () => {
    const lines = [collect('a', 'S1', 1, 'ch-1'), collect('b', 'S1', 2, 'ch-3')];
    expect(planStoreChange(lines, 'ch-2')).toEqual([
      { kind: 'set', lineId: 'a', fulfilment: 'collect', channelId: 'ch-2' },
      { kind: 'merge', keepId: 'a', quantity: 3, removeId: 'b' },
    ]);
  });

  it('nothing to move gives no operations', () => {
    expect(planStoreChange([collect('a', 'S1', 1, 'ch-2'), line('b', 'S2', 1)], 'ch-2')).toEqual([]);
  });
});

describe('groups', () => {
  const mk = (id: string, fulfilment: 'collect' | 'delivery' | 'subscribe', storeKey?: string) => {
    const s = storeKey ? store(storeKey) : undefined;
    return { id, fulfilment, store: s, groupKey: groupKeyOf({ fulfilment, store: s }) };
  };

  it('group order is collect stores then ship then subscribe', () => {
    const groups = groupLines([mk('1', 'subscribe'), mk('2', 'delivery'), mk('3', 'collect', 'soho'), mk('4', 'collect', 'brooklyn'), mk('5', 'collect', 'soho')]);
    expect(groups.map((g) => g.key)).toEqual(['collect:soho', 'collect:brooklyn', 'delivery', 'subscribe']);
    expect(groups[0].lineIds).toEqual(['3', '5']);
  });

  it('groupKeyOf is one key per store', () => {
    expect(groupKeyOf({ fulfilment: 'collect', store: store('soho') })).toBe('collect:soho');
    expect(groupKeyOf({ fulfilment: 'delivery' })).toBe('delivery');
    expect(groupKeyOf({ fulfilment: 'subscribe' })).toBe('subscribe');
  });

  it('a bag with collect, ship and subscribe lines yields three groups with the lines assigned to the right group', () => {
    const groups = groupLines([mk('m', 'delivery'), mk('c', 'collect', 'soho'), mk('s', 'subscribe')]);
    expect(groups.map((g) => [g.kind, g.lineIds])).toEqual([['collect', ['c']], ['delivery', ['m']], ['subscribe', ['s']]]);
    expect(groups[0].store?.key).toBe('soho');
  });

  it('empty groups are omitted', () => {
    expect(groupLines([mk('m', 'delivery')]).map((g) => g.key)).toEqual(['delivery']);
    expect(groupLines([])).toEqual([]);
  });
});
