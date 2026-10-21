// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { guardProject, planTransition, runState, type OrdersPort } from './order-ops';

function port(stateKey?: string) {
  const calls: string[] = [];
  const p: OrdersPort = {
    findByNumber: async (n) => (n === 'MC-ABCDEFGHJK' ? { id: 'o1', version: 4, ...(stateKey ? { stateKey } : {}) } : undefined),
    transition: async (id, version, key) => {
      calls.push(`${id}@${version}->${key}`);
    },
  };
  return { p, calls };
}
const run = async (p: OrdersPort, to: string, dryRun = false) => {
  const lines: string[] = [];
  const code = await runState(p, { orderNumber: 'MC-ABCDEFGHJK', to, dryRun }, (l) => lines.push(l));
  return { code, lines };
};

describe('order-ops state', () => {
  it('order-ops refuses a foreign project key', () => {
    expect(() => guardProject('other-project', 'spec-test-b2c-food')).toThrow(/mismatch/);
    expect(() => guardProject('health-project', 'health-project')).toThrow(/another team/);
    expect(() => guardProject('spec-test-b2c-food', 'spec-test-b2c-food')).not.toThrow();
  });
  it('order-ops refuses skipping a state', async () => {
    const { p, calls } = port('mcf-order-ordered');
    const r = await run(p, 'ready-for-collection');
    expect(r.code).toBe(1);
    expect(r.lines[0]).toMatch(/cannot skip/);
    expect(calls).toEqual([]);
  });
  it('moves one step along the chain and reports it', async () => {
    const { p, calls } = port('mcf-order-ordered');
    expect((await run(p, 'preparing')).code).toBe(0);
    expect(calls).toEqual(['o1@4->mcf-order-preparing']);
  });
  it('a dry run writes nothing', async () => {
    const { p, calls } = port('mcf-order-preparing');
    const r = await run(p, 'ready-for-collection', true);
    expect(r.lines[0]).toMatch(/dry run/);
    expect(calls).toEqual([]);
  });
  it('an order with no state can only go to ordered', () => {
    expect(planTransition(undefined, 'ordered')).toEqual({ kind: 'move', to: 'mcf-order-ordered' });
    expect(planTransition(undefined, 'preparing').kind).toBe('refuse');
  });
  it('never goes back, never repeats, never accepts an unknown name', () => {
    expect(planTransition('mcf-order-ready-for-collection', 'preparing').kind).toBe('refuse');
    expect(planTransition('mcf-order-collected', 'collected').kind).toBe('noop');
    expect(planTransition('mcf-order-ordered', 'nonsense').kind).toBe('refuse');
    expect(planTransition('other-state', 'preparing').kind).toBe('refuse');
  });
  it('refuses a number that is not one of ours and an unknown order', async () => {
    const { p } = port();
    const lines: string[] = [];
    expect(await runState(p, { orderNumber: '"; drop', to: 'preparing', dryRun: true }, (l) => lines.push(l))).toBe(1);
    expect(await runState(p, { orderNumber: 'MC-ZZZZZZZZZZ', to: 'preparing', dryRun: true }, (l) => lines.push(l))).toBe(1);
  });
});
