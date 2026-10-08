import { describe, expect, it } from 'vitest';
import { decideRun, type RunInput, type RunLine } from './decide-run';

const line = (over: Partial<RunLine> = {}): RunLine => ({ lineRef: 'a', qty: 30, packs: 1, rx: { refillsLeft: 2, expiresAt: '2027-01-01' }, perOrderMax: null, periodCeiling: null, usedInPeriod: 0, ...over });
const input = (lines: RunLine[], over: Partial<RunInput> = {}): RunInput => ({ lines, today: '2026-11-08', hasPaymentMethod: true, ...over });

describe('subscriptions-and-recurring-orders: the gate in front of a generated refill', () => {
  it('a valid authorization, no ceiling and a saved method: the run goes ahead', () => {
    expect(decideRun(input([line()]))).toEqual({ run: true });
  });

  it('the authorization lapses between runs: no order, the reason is recorded, the series is paused (resumable)', () => {
    // The check happens on 2026-11-07 against a run on 2026-11-08: the date of the run decides.
    const d = decideRun(input([line({ rx: { refillsLeft: 2, expiresAt: '2026-11-07' } })]));
    expect(d).toEqual({ run: false, action: 'pause', outcome: 'skipped', reason: 'authorization-expired', lineRefs: ['a'] });
  });

  it('an expiry on the day of the run still allows it (the window is inclusive)', () => {
    expect(decideRun(input([line({ rx: { refillsLeft: 1, expiresAt: '2026-11-08' } })]))).toEqual({ run: true });
  });

  it('exhausted: the series STOPS (canceled), not merely skipped', () => {
    const d = decideRun(input([line({ rx: { refillsLeft: 0 } })]));
    expect(d).toEqual({ run: false, action: 'cancel', outcome: 'stopped', reason: 'authorization-exhausted', lineRefs: ['a'] });
  });

  it('exhausted outranks expired and ceilings; an expired-and-exhausted line counts as expired (rules: expiry first)', () => {
    const d = decideRun(input([line({ lineRef: 'a', rx: { refillsLeft: 0 } }), line({ lineRef: 'b', rx: { refillsLeft: 3, expiresAt: '2020-01-01' } })]));
    expect(d).toMatchObject({ action: 'cancel', reason: 'authorization-exhausted', lineRefs: ['a'] });
    const e = decideRun(input([line({ rx: { refillsLeft: 0, expiresAt: '2020-01-01' } })]));
    expect(e).toMatchObject({ action: 'pause', reason: 'authorization-expired' });
  });

  it('a prescription that no longer exists pauses the series with its own reason', () => {
    expect(decideRun(input([line({ rx: null })]))).toMatchObject({ action: 'pause', outcome: 'skipped', reason: 'prescription-missing' });
  });

  it('no saved payment method pauses the series', () => {
    expect(decideRun(input([line()], { hasPaymentMethod: false }))).toMatchObject({ action: 'pause', reason: 'payment-method-missing', lineRefs: [] });
  });

  it('a monthly ceiling already reached skips only this run; a per-order limit below the packs does the same', () => {
    expect(decideRun(input([line({ periodCeiling: 2, usedInPeriod: 2 })]))).toEqual({ run: false, action: 'skip', outcome: 'skipped', reason: 'ceiling', lineRefs: ['a'] });
    expect(decideRun(input([line({ packs: 3, perOrderMax: 2 })]))).toMatchObject({ action: 'skip', reason: 'ceiling' });
    expect(decideRun(input([line({ periodCeiling: 2, usedInPeriod: 1 })]))).toEqual({ run: true });
  });

  it('every blocked line is named by reference only (no names, no RX numbers) and one blocked line blocks the whole run', () => {
    const d = decideRun(input([line({ lineRef: 'a' }), line({ lineRef: 'b', rx: { refillsLeft: 0 } }), line({ lineRef: 'c', rx: { refillsLeft: 0 } })]));
    expect(d).toMatchObject({ run: false, lineRefs: ['b', 'c'] });
  });

  it('is pure: the same input gives the same answer and the input is not changed', () => {
    const i = input([line({ rx: { refillsLeft: 0 } })]);
    const before = JSON.stringify(i);
    expect(decideRun(i)).toEqual(decideRun(i));
    expect(JSON.stringify(i)).toBe(before);
  });
});
