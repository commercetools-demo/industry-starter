import { describe, expect, it } from 'vitest';
import { advanceOrder, normalizeState, TransitionRefusedError } from './advance-order';
import { createFakeRoot } from './fake-root';
import { makeCtx } from './lib';
import { runSeed } from './seed';

const ctxOf = (fake: ReturnType<typeof createFakeRoot>, dryRun = false) => ({ ...makeCtx(fake.root, { dryRun }, () => {}), pauseMs: 0 });

async function withOrder(stateKey?: string) {
  const fake = createFakeRoot();
  await runSeed(ctxOf(fake)); // creates the mlv-* states
  const state = stateKey ? fake.store.states.find((s) => s.key === stateKey) : undefined;
  fake.store.orders.push({ id: 'o1', version: 1, orderNumber: 'MLV-1001', ...(state ? { state: { typeId: 'state', id: state.id } } : {}) });
  return fake;
}
const stateOfOrder = (fake: ReturnType<typeof createFakeRoot>) => fake.store.states.find((s) => s.id === (fake.store.orders[0].state as { id: string } | undefined)?.id)?.key;

describe('advance-order.ts (F-08)', () => {
  it('moves an order along an allowed transition, with or without the mlv- prefix', async () => {
    const fake = await withOrder('mlv-received');
    expect(await advanceOrder(ctxOf(fake), 'MLV-1001', 'pharmacist-review')).toEqual({ orderNumber: 'MLV-1001', from: 'mlv-received', to: 'mlv-pharmacist-review', changed: true });
    expect(stateOfOrder(fake)).toBe('mlv-pharmacist-review');
    await advanceOrder(ctxOf(fake), 'MLV-1001', 'mlv-packed-shipped');
    await advanceOrder(ctxOf(fake), 'MLV-1001', 'delivered');
    expect(stateOfOrder(fake)).toBe('mlv-delivered');
    expect(fake.log.filter((l) => l.kind === 'orders').map((l) => l.actions)).toEqual([['transitionState'], ['transitionState'], ['transitionState']]);
  });

  it('refuses an unknown transition and writes nothing', async () => {
    const fake = await withOrder('mlv-received');
    const before = fake.log.length;
    await expect(advanceOrder(ctxOf(fake), 'MLV-1001', 'delivered')).rejects.toThrow(/not allowed.*mlv-pharmacist-review, mlv-cancelled/);
    await expect(advanceOrder(ctxOf(fake), 'MLV-1001', 'shipped-to-mars')).rejects.toBeInstanceOf(TransitionRefusedError);
    expect(fake.log.length).toBe(before);
  });

  it('final states cannot be left; going backwards is refused', async () => {
    const fake = await withOrder('mlv-delivered');
    await expect(advanceOrder(ctxOf(fake), 'MLV-1001', 'received')).rejects.toThrow(/final state/);
    const f2 = await withOrder('mlv-packed-shipped');
    await expect(advanceOrder(ctxOf(f2), 'MLV-1001', 'pharmacist-review')).rejects.toBeInstanceOf(TransitionRefusedError);
  });

  it('an order without a state may only enter the initial state', async () => {
    const fake = await withOrder();
    await expect(advanceOrder(ctxOf(fake), 'MLV-1001', 'delivered')).rejects.toBeInstanceOf(TransitionRefusedError);
    expect((await advanceOrder(ctxOf(fake), 'MLV-1001', 'received')).from).toBeNull();
    expect(stateOfOrder(fake)).toBe('mlv-received');
  });

  it('already in the target state is a no-op', async () => {
    const fake = await withOrder('mlv-received');
    const before = fake.log.length;
    expect(await advanceOrder(ctxOf(fake), 'MLV-1001', 'received')).toMatchObject({ changed: false });
    expect(fake.log.length).toBe(before);
  });

  it('unknown order number, bad characters and a foreign state are refused', async () => {
    const fake = await withOrder('mlv-received');
    await expect(advanceOrder(ctxOf(fake), 'NOPE-1', 'pharmacist-review')).rejects.toThrow('No order');
    await expect(advanceOrder(ctxOf(fake), 'x" or 1=1', 'pharmacist-review')).rejects.toBeInstanceOf(TransitionRefusedError);
    fake.store.states.push({ id: 'foreign', key: 'sample-state', version: 1 });
    fake.store.orders[0].state = { typeId: 'state', id: 'foreign' };
    await expect(advanceOrder(ctxOf(fake), 'MLV-1001', 'pharmacist-review')).rejects.toThrow('not an mlv- state');
  });

  it('dry run reports the move but does not write', async () => {
    const fake = await withOrder('mlv-received');
    const before = fake.log.length;
    expect(await advanceOrder(ctxOf(fake, true), 'MLV-1001', 'cancelled')).toMatchObject({ changed: true, to: 'mlv-cancelled' });
    expect(fake.log.length).toBe(before);
    expect(stateOfOrder(fake)).toBe('mlv-received');
  });

  it('normalizeState adds the prefix once', () => {
    expect(normalizeState('delivered')).toBe('mlv-delivered');
    expect(normalizeState('mlv-delivered')).toBe('mlv-delivered');
  });
});
