import { afterEach, describe, it, expect, vi } from 'vitest';
import { RECURRENCE_POLICY_KEYS, isRecurrencePolicyKey, parseSubscriptionsFlag, subscriptionsEnabled } from './features';

afterEach(() => vi.unstubAllEnvs());

describe('feature flag', () => {
  it('Spike fails (flag off): only the string "false" switches subscriptions off', () => {
    expect(parseSubscriptionsFlag(undefined)).toBe(true);
    expect(parseSubscriptionsFlag('')).toBe(true);
    expect(parseSubscriptionsFlag('true')).toBe(true);
    expect(parseSubscriptionsFlag('0')).toBe(true);
    expect(parseSubscriptionsFlag('false')).toBe(false);
  });

  it('reads FEATURE_SUBSCRIPTIONS at call time', () => {
    vi.stubEnv('FEATURE_SUBSCRIPTIONS', 'false');
    expect(subscriptionsEnabled()).toBe(false);
    vi.stubEnv('FEATURE_SUBSCRIPTIONS', 'true');
    expect(subscriptionsEnabled()).toBe(true);
  });
});

describe('policy keys', () => {
  it('are weekly, every-2-weeks and monthly only', () => {
    expect([...RECURRENCE_POLICY_KEYS]).toEqual(['weekly', 'every-2-weeks', 'monthly']);
    expect(isRecurrencePolicyKey('monthly')).toBe(true);
    expect(isRecurrencePolicyKey('daily')).toBe(false);
    expect(isRecurrencePolicyKey(3)).toBe(false);
  });
});
