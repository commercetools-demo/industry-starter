// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';

let fake: FakeObjects;
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (fake as unknown as Record<string, unknown>)[p as string] }) }));

import { CONTAINERS } from '@/lib/ct/custom-objects';
import type { AllowanceCycle, AllowanceLedgerEntry } from '@/lib/funding/allowance-types';
import { drawdown, getAllowanceView, getBalance, grantCycle, reloadAllowances, restoreAllowance } from './allowance';

const SAM = 'pt_sam';
const OCT = new Date('2026-10-08T12:00:00Z');
const NOV = new Date('2026-11-02T12:00:00Z');

beforeEach(() => {
  fake = createFakeObjects();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

const cycleObject = (cycle: string) => fake.objects.find((o) => o.container === CONTAINERS.allowance && o.key === `${SAM}_${cycle}`);
const cycleValue = (cycle: string) => cycleObject(cycle)?.value as AllowanceCycle;
const ledger = (orderId: string) => fake.objects.find((o) => o.container === CONTAINERS.allowanceLedger && o.key === orderId)?.value as AllowanceLedgerEntry | undefined;

describe('benefit-allowance-drawdown: drawdown (U-05)', () => {
  it('Allowance covers the order: the whole amount is drawn and the balance drops by it', async () => {
    await grantCycle(SAM, '2026-10', 5000);
    const out = await drawdown(SAM, 'ord-1', 3000, OCT);
    expect(out).toEqual({ applied: 3000, alreadyApplied: false, cycle: '2026-10' });
    expect(await getBalance(SAM, OCT)).toBe(2000);
    expect(ledger('ord-1')).toMatchObject({ orderId: 'ord-1', patientRef: SAM, cycle: '2026-10', amount: 3000 });
  });

  it('Allowance partly covers the order: only the balance is drawn, the rest is left for the next tender', async () => {
    await grantCycle(SAM, '2026-10', 5000);
    await drawdown(SAM, 'ord-0', 4000, OCT);
    const out = await drawdown(SAM, 'ord-1', 3000, OCT);
    expect(out.applied).toBe(1000);
    expect(await getBalance(SAM, OCT)).toBe(0);
    expect(cycleValue('2026-10').consumed).toBe(5000);
  });

  it('idempotent on the order id: a retry draws nothing more', async () => {
    await grantCycle(SAM, '2026-10', 5000);
    await drawdown(SAM, 'ord-1', 3000, OCT);
    const again = await drawdown(SAM, 'ord-1', 3000, OCT);
    expect(again).toEqual({ applied: 3000, alreadyApplied: true, cycle: '2026-10' });
    expect(cycleValue('2026-10').consumed).toBe(3000);
  });

  it('a retry after a crash between the draw and the index entry still ends with one draw and an index entry', async () => {
    await grantCycle(SAM, '2026-10', 5000);
    fake.failOn = (op, container) => (op === 'post' && container === CONTAINERS.allowanceLedger ? new Error('network') : undefined);
    await expect(drawdown(SAM, 'ord-1', 3000, OCT)).rejects.toThrow('network');
    fake.failOn = undefined;
    await drawdown(SAM, 'ord-1', 3000, OCT);
    expect(cycleValue('2026-10').consumed).toBe(3000);
    expect(ledger('ord-1')?.amount).toBe(3000);
  });

  it('concurrent orders cannot draw the same money twice: version conflicts re-read and the totals never exceed the grant', async () => {
    await grantCycle(SAM, '2026-10', 5000);
    const results = await Promise.all([drawdown(SAM, 'ord-a', 3000, OCT), drawdown(SAM, 'ord-b', 3000, OCT), drawdown(SAM, 'ord-c', 3000, OCT)]);
    const total = results.reduce((sum, r) => sum + r.applied, 0);
    expect(total).toBe(5000);
    expect(cycleValue('2026-10').consumed).toBe(5000);
    expect(await getBalance(SAM, OCT)).toBe(0);
  });

  it('a member without an allowance draws nothing', async () => {
    expect(await drawdown('pt_alex', 'ord-1', 3000, OCT)).toEqual({ applied: 0, alreadyApplied: false, cycle: null });
    expect(await getAllowanceView('pt_alex', OCT)).toBeNull();
  });

  it('Balance visible before committing: the view has balance, forfeit date and the lapsing amount', async () => {
    await grantCycle(SAM, '2026-10', 5000);
    await drawdown(SAM, 'ord-1', 1200, OCT);
    expect(await getAllowanceView(SAM, OCT)).toMatchObject({ cycle: '2026-10', granted: 5000, consumed: 1200, balance: 3800, lapsing: 3800, forfeitsOn: '2026-11-01', lastLapsed: null });
  });
});

describe('benefit-allowance-drawdown: return restores the balance (U-05)', () => {
  it('Return restores the balance: an open cycle gets the amount back, once', async () => {
    await grantCycle(SAM, '2026-10', 5000);
    await drawdown(SAM, 'ord-1', 3000, OCT);
    expect(await restoreAllowance('ord-1', OCT)).toEqual({ outcome: 'restored', amount: 3000 });
    expect(await getBalance(SAM, OCT)).toBe(5000);
    expect(await restoreAllowance('ord-1', OCT)).toEqual({ outcome: 'already', amount: 3000 });
    expect(await getBalance(SAM, OCT)).toBe(5000);
    expect(ledger('ord-1')).toMatchObject({ outcome: 'restored' });
  });

  it('a cycle that has closed: the restore is reported as unrecoverable and no balance is changed', async () => {
    await grantCycle(SAM, '2026-10', 5000);
    await drawdown(SAM, 'ord-1', 3000, OCT);
    await reloadAllowances(NOV);
    const before = structuredClone(cycleValue('2026-11'));
    expect(await restoreAllowance('ord-1', NOV)).toEqual({ outcome: 'unrecoverable', amount: 3000 });
    expect(cycleValue('2026-11')).toEqual(before);
    expect(ledger('ord-1')).toMatchObject({ outcome: 'unrecoverable' });
  });

  it('an order that never drew is a no-op', async () => {
    expect(await restoreAllowance('ord-none', OCT)).toEqual({ outcome: 'none', amount: 0 });
  });
});

describe('benefit-allowance-drawdown: cycle reload (U-05, U-07)', () => {
  it('Cycle reload: the next cycle is granted once and the unspent balance is forfeited, not carried over', async () => {
    await grantCycle(SAM, '2026-10', 5000);
    await drawdown(SAM, 'ord-1', 1500, OCT);
    const first = await reloadAllowances(NOV);
    expect(first).toMatchObject({ members: 1, granted: 1, lapsedCycles: 1, lapsedCents: 3500 });
    expect(cycleValue('2026-11')).toMatchObject({ granted: 5000, consumed: 0, lapsed: 0 });
    expect(cycleValue('2026-10')).toMatchObject({ lapsed: 3500 });
    expect(await getBalance(SAM, NOV)).toBe(5000);
    const view = await getAllowanceView(SAM, NOV);
    expect(view?.lastLapsed).toEqual({ cycle: '2026-10', amount: 3500 });
  });

  it('run twice = once: the second reload grants nothing and forfeits nothing', async () => {
    await grantCycle(SAM, '2026-10', 5000);
    await reloadAllowances(NOV);
    const snapshot = JSON.stringify(fake.objects.map((o) => [o.key, o.version, o.value]));
    const second = await reloadAllowances(NOV);
    expect(second).toMatchObject({ granted: 0, lapsedCycles: 0, lapsedCents: 0 });
    expect(JSON.stringify(fake.objects.map((o) => [o.key, o.version, o.value]))).toBe(snapshot);
  });

  it('grantCycle is idempotent per member per cycle', async () => {
    expect(await grantCycle(SAM, '2026-10', 5000)).toEqual({ created: true });
    expect(await grantCycle(SAM, '2026-10', 9999)).toEqual({ created: false });
    expect(cycleValue('2026-10').granted).toBe(5000);
  });

  it('a missed month is caught up: every earlier cycle is forfeited, only the current one is granted', async () => {
    await grantCycle(SAM, '2026-10', 5000);
    const DEC = new Date('2026-12-03T12:00:00Z');
    await reloadAllowances(DEC);
    expect(cycleValue('2026-10').lapsed).toBe(5000);
    expect(cycleObject('2026-11')).toBeUndefined();
    expect(cycleValue('2026-12').granted).toBe(5000);
  });
});
