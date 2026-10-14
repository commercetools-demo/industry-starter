import { describe, expect, it } from 'vitest';
import { CODE_STATES, codeStatus } from './code-status';

describe('codeStatus', () => {
  it('BRAKE5 on a cart without brake parts reads "Not applied: cart doesn\'t match"', () => {
    expect(codeStatus('DoesNotMatchCart')).toEqual({ key: 'DoesNotMatchCart', label: "Not applied: cart doesn't match", applied: false });
  });
  it('MatchesCart reads Applied', () => {
    expect(codeStatus('MatchesCart')).toMatchObject({ label: 'Applied', applied: true });
  });
  it('every state has its own sentence and only MatchesCart is applied', () => {
    const labels = CODE_STATES.map((s) => codeStatus(s).label);
    expect(new Set(labels).size).toBe(6);
    expect(CODE_STATES.filter((s) => codeStatus(s).applied)).toEqual(['MatchesCart']);
    for (const s of ['NotActive', 'NotValid', 'MaxApplicationReached', 'ApplicationStoppedByPreviousDiscount'] as const) expect(codeStatus(s).label).toMatch(/^Not applied: /);
  });
});
