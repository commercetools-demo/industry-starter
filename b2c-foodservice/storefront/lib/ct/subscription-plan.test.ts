import { describe, expect, it } from 'vitest';
import { parseSubscriptionAction, planAction } from '@/lib/ct/subscription-plan';
import { POLICY_2W, ctRecurringOrder } from '@/test/recurring';

const state = (s: string, extra: Record<string, unknown> = {}) => ctRecurringOrder({ recurringOrderState: s, ...extra });

describe('planAction', () => {
  it('pause sends setRecurringOrderState paused', () => {
    expect(planAction(state('Active'), { action: 'pause' })).toEqual({ action: 'setRecurringOrderState', recurringOrderState: { type: 'paused' } });
  });

  it('resume sends active, cancel sends canceled with one l', () => {
    expect(planAction(state('Paused'), { action: 'resume' })).toEqual({ action: 'setRecurringOrderState', recurringOrderState: { type: 'active' } });
    expect(planAction(state('Paused'), { action: 'cancel' })).toEqual({ action: 'setRecurringOrderState', recurringOrderState: { type: 'canceled' } });
  });

  it('skip sends the counter draft, cumulative over an earlier skip', () => {
    expect(planAction(state('Active'), { action: 'skip' })).toEqual({
      action: 'setOrderSkipConfiguration', skipConfigurationInputDraft: { type: 'Counter', totalToSkip: 1 },
    });
    const done = state('Active', { skipConfiguration: { type: 'Counter', totalToSkip: 1, skipped: 1 } });
    expect(planAction(done, { action: 'skip' })).toMatchObject({ skipConfigurationInputDraft: { totalToSkip: 2 } });
  });

  it('setInterval sends setSchedule with the policy', () => {
    expect(planAction(state('Active'), { action: 'setInterval', recurrencePolicyId: POLICY_2W })).toEqual({
      action: 'setSchedule', recurrencePolicy: { typeId: 'recurrence-policy', id: POLICY_2W },
    });
  });

  it('resume of a canceled subscription is invalid_state', () => {
    for (const s of ['Canceled', 'Expired']) {
      expect(() => planAction(state(s), { action: 'resume' })).toThrow(expect.objectContaining({ code: 'invalid_state', status: 422 }));
    }
    expect(() => planAction(state('Canceled'), { action: 'cancel' })).toThrow(expect.objectContaining({ code: 'invalid_state' }));
    expect(() => planAction(state('Paused'), { action: 'pause' })).toThrow(expect.objectContaining({ code: 'invalid_state' }));
    expect(() => planAction(state('Paused'), { action: 'skip' })).toThrow(expect.objectContaining({ code: 'invalid_state' }));
  });

  it('skip and setInterval are refused while a skip is pending (a schedule cannot change with an active skip)', () => {
    const pending = state('Active', { skipConfiguration: { type: 'Counter', totalToSkip: 1, skipped: 0 } });
    expect(() => planAction(pending, { action: 'skip' })).toThrow(expect.objectContaining({ code: 'invalid_state' }));
    expect(() => planAction(pending, { action: 'setInterval', recurrencePolicyId: POLICY_2W })).toThrow(expect.objectContaining({ code: 'invalid_state' }));
  });
});

describe('parseSubscriptionAction', () => {
  it('allow-lists actions and drops everything else', () => {
    expect(parseSubscriptionAction({ action: 'skip', version: 99, customerId: 'x' })).toEqual({ action: 'skip' });
    expect(() => parseSubscriptionAction({ action: 'delete' })).toThrow(expect.objectContaining({ code: 'invalid_request' }));
    expect(() => parseSubscriptionAction({ action: 'setInterval', recurrencePolicyId: 'x' })).toThrow(expect.objectContaining({ code: 'invalid_request' }));
    expect(() => parseSubscriptionAction(null)).toThrow(expect.objectContaining({ code: 'invalid_request' }));
  });
});
