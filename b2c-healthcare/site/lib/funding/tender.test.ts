import { describe, expect, it } from 'vitest';
import { allocateTender, buildTenderView, planTender } from './tender';

const L = (id: string, eligible: boolean, amount: number) => ({ id, eligible, amount });

describe('tender order: allowance, then restricted, then card (U-06, U-09)', () => {
  it('Allowance covers the order: nothing is left for the restricted instrument or the card', () => {
    expect(planTender({ total: 3000, allowanceBalance: 5000, eligibleSubtotal: 3000, restrictedChosen: true })).toEqual({ total: 3000, allowance: 3000, restricted: 0, card: 0 });
  });

  it('Allowance partly covers the order: the remainder goes to the card', () => {
    expect(planTender({ total: 3000, allowanceBalance: 1200, eligibleSubtotal: 0, restrictedChosen: false })).toEqual({ total: 3000, allowance: 1200, restricted: 0, card: 1800 });
  });

  it('Wholly eligible basket: the restricted instrument settles everything the allowance left', () => {
    expect(planTender({ total: 3015, allowanceBalance: 0, eligibleSubtotal: 3015, restrictedChosen: true })).toEqual({ total: 3015, allowance: 0, restricted: 3015, card: 0 });
  });

  it('Mixed basket splits: the instrument is capped at the eligible subtotal, the card pays the rest including delivery', () => {
    expect(planTender({ total: 4000, allowanceBalance: 0, eligibleSubtotal: 2495, restrictedChosen: true })).toEqual({ total: 4000, allowance: 0, restricted: 2495, card: 1505 });
  });

  it('Wholly ineligible basket: the instrument pays nothing even if chosen', () => {
    expect(planTender({ total: 2570, allowanceBalance: 0, eligibleSubtotal: 0, restrictedChosen: true })).toMatchObject({ restricted: 0, card: 2570 });
  });

  it('all three: allowance first, then restricted up to the eligible subtotal, then the card', () => {
    expect(planTender({ total: 4000, allowanceBalance: 1000, eligibleSubtotal: 2495, restrictedChosen: true })).toEqual({ total: 4000, allowance: 1000, restricted: 2495, card: 505 });
  });

  it('the parts always add up to the total', () => {
    for (const total of [0, 1, 999, 4000]) {
      for (const bal of [0, 500, 5000]) {
        for (const elig of [0, 700, 5000]) {
          const p = planTender({ total, allowanceBalance: bal, eligibleSubtotal: elig, restrictedChosen: true });
          expect(p.allowance + p.restricted + p.card).toBe(total);
          expect(p.card).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('which instrument settled which line (U-09)', () => {
  it('Eligibility visible on the order: the restricted instrument takes eligible lines, the card the ineligible ones and delivery', () => {
    const lines = [L('a', true, 1875), L('b', false, 1260)];
    const plan = planTender({ total: 3635, allowanceBalance: 0, eligibleSubtotal: 1875, restrictedChosen: true });
    expect(allocateTender(lines, plan)).toEqual([
      { id: 'a', allowance: 0, restricted: 1875, card: 0 },
      { id: 'b', allowance: 0, restricted: 0, card: 1260 },
    ]);
  });

  it('the allowance covers delivery first, then ineligible lines, keeping eligible value for the instrument', () => {
    const lines = [L('a', true, 1000), L('b', false, 1000)];
    const plan = planTender({ total: 2500, allowanceBalance: 1200, eligibleSubtotal: 1000, restrictedChosen: true });
    const out = allocateTender(lines, plan);
    expect(out[1]).toEqual({ id: 'b', allowance: 700, restricted: 0, card: 300 });
    expect(out[0]).toEqual({ id: 'a', allowance: 0, restricted: 1000, card: 0 });
    for (const [i, line] of lines.entries()) expect(out[i]!.allowance + out[i]!.restricted + out[i]!.card).toBe(line.amount);
  });
});

describe('the tender view (U-10)', () => {
  const view = (over: Partial<Parameters<typeof buildTenderView>[0]> = {}) =>
    buildTenderView({ currencyCode: 'USD', fractionDigits: 2, total: 3635, allowance: null, lines: [L('a', true, 1875), L('b', false, 1260)], restrictedChosen: false, ...over });

  it('Eligible subtotal shown on the basket and the amount needing another tender', () => {
    const v = view();
    expect(v.restricted).toMatchObject({ available: true, eligibleSubtotal: { centAmount: 1875 }, applies: { centAmount: 1875 }, chosen: false });
    expect(v.needsOtherTender.centAmount).toBe(1760);
    expect(v.card.centAmount).toBe(3635);
  });

  it('chosen: the card figure drops by what the instrument pays', () => {
    expect(view({ restrictedChosen: true }).card.centAmount).toBe(1760);
  });

  it('Wholly ineligible basket: the instrument is unavailable with the reason', () => {
    const v = view({ lines: [L('b', false, 1260)], total: 1260, restrictedChosen: true });
    expect(v.restricted).toMatchObject({ available: false, reason: 'none-eligible', chosen: false });
    expect(v.card.centAmount).toBe(1260);
  });

  it('Balance visible before committing: the allowance balance, what this order would use, and the forfeit date', () => {
    const v = view({ allowance: { cycle: '2026-10', currency: 'USD', granted: 5000, consumed: 2000, balance: 3000, forfeitsOn: '2026-11-01', lapsing: 3000, lastLapsed: null } });
    expect(v.allowance).toMatchObject({ balance: { centAmount: 3000 }, applies: { centAmount: 3000 }, forfeitsOn: '2026-11-01' });
    expect(v.card.centAmount).toBe(635);
  });
});
