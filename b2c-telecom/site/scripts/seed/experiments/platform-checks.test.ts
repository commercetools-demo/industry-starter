import { describe, expect, it } from 'vitest';
import { CtHttpError, type CtApi } from '../lib';
import { Lab, attempt, main, renderFindings } from './platform-checks';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' };

/** A scripted API: records every call; `fail` makes the matching call throw. */
function scripted(fail: (method: string, path: string) => CtHttpError | undefined = () => undefined): CtApi & { calls: string[] } {
  const calls: string[] = [];
  let id = 0;
  const api = {
    calls,
    writes: 0,
    async get(path: string) {
      calls.push(`GET ${path}`);
      const failure = fail('GET', path);
      if (failure) throw failure;
      if (path === '') return { key: 'spec-test-b2c-telecom' };
      if (path === 'recurring-orders') return { results: [{ id: 'ro-1', version: 2 }] };
      if (path.startsWith('types/')) return null;
      if (/^(carts|orders|customers)\/.+/.test(path)) return { id: path.split('/')[1], version: 7, orderNumber: 'n' };
      return null;
    },
    async post(path: string) {
      calls.push(`POST ${path}`);
      const failure = fail('POST', path);
      if (failure) throw failure;
      id += 1;
      if (path === 'customers') return { customer: { id: `cust-${id}`, version: 1 } };
      if (path.startsWith('recurring-orders/')) return { id: 'ro-1', version: 3 };
      return { id: `${path}-${id}`, version: 1, orderNumber: `MLV-EXP-${id}` };
    },
    async del(path: string) {
      calls.push(`DELETE ${path}`);
      const failure = fail('DELETE', path);
      if (failure) throw failure;
      return {};
    },
  };
  return api as CtApi & { calls: string[] };
}

describe('platform experiments', () => {
  it('attempt turns a platform error into a readable outcome instead of throwing', async () => {
    const result = await attempt(async () => {
      throw new CtHttpError(400, 'Shipping address is not set.', 'InvalidOperation');
    });
    expect(result).toEqual({ ok: false, error: '400 InvalidOperation: Shipping address is not set.' });
    expect(await attempt(async () => 5)).toEqual({ ok: true, value: 5 });
  });

  it('cleanup deletes recurring orders, then orders, carts and the customer, and reports what stayed', async () => {
    const api = scripted((method, path) => (method === 'DELETE' && path.startsWith('carts/') ? new CtHttpError(409, 'busy', 'ConcurrentModification') : undefined));
    const lab = new Lab(api, 'test');
    await lab.init();
    const cart = await lab.cart({ lineItems: [] });
    expect(cart.ok).toBe(true);
    if (cart.ok) await lab.order(cart.value);
    api.calls.length = 0;
    const leftovers = await lab.cleanup();
    const order = api.calls.filter((c) => c.startsWith('DELETE') || c.startsWith('POST recurring-orders/'));
    expect(order[0]).toMatch(/^POST recurring-orders\/ro-1/);
    expect(order[1]).toBe('DELETE recurring-orders/ro-1');
    expect(order[2]).toMatch(/^DELETE orders\//);
    expect(order[3]).toMatch(/^DELETE carts\//);
    expect(order[4]).toMatch(/^DELETE customers\//);
    expect(leftovers).toHaveLength(1);
    expect(leftovers[0]).toMatch(/^cart /);
    expect(lab.created.carts).toHaveLength(0);
  });

  it('every cart carries the throwaway customer and a shipping address, and orders get numbered MLV-EXP', async () => {
    const api = scripted();
    const lab = new Lab(api, 'abc');
    await lab.init();
    expect(lab.customerId).toMatch(/^cust-/);
    expect(lab.orderNumber()).toBe('MLV-EXP-abc-1');
    expect(lab.orderNumber()).toBe('MLV-EXP-abc-2');
  });

  it('refuses to run without --confirm-project and never touches the platform', async () => {
    const api = scripted();
    const lines: string[] = [];
    const code = await main([], { api, source: SOURCE, log: (l) => lines.push(l) });
    expect(code).toBe(2);
    expect(api.calls).toEqual([]);
  });

  it('runs only the named experiments, records a crash as a note and always cleans up', async () => {
    const api = scripted();
    const ran: string[] = [];
    const lines: string[] = [];
    const code = await main(['--confirm-project', 'spec-test-b2c-telecom', '--only', 'b,c'], {
      api,
      source: SOURCE,
      log: (l) => lines.push(l),
      experiments: {
        a: async () => void ran.push('a'),
        b: async (lab) => {
          ran.push('b');
          lab.note('b', 'something', true, 'fine');
        },
        c: async () => {
          throw new Error('boom');
        },
      },
    });
    expect(code).toBe(0);
    expect(ran).toEqual(['b']);
    const out = lines.join('\n');
    expect(out).toContain('- OK: something -> fine');
    expect(out).toContain('- NOTE: experiment crashed -> boom');
    expect(out).toContain('Cleanup: every throwaway cart, order and recurring order was deleted.');
    expect(api.calls.some((c) => c.startsWith('DELETE customers/'))).toBe(true);
  });

  it('renders findings grouped by experiment', () => {
    expect(
      renderFindings([
        { experiment: 'inventory', title: 't1', ok: true, detail: 'd1' },
        { experiment: 'shipping', title: 't2', ok: false, detail: 'd2' },
      ]),
    ).toBe('### inventory\n- OK: t1 -> d1\n\n### shipping\n- NOTE: t2 -> d2');
  });
});
