import { LOGIN_LOCKOUT, RATE_LIMITS } from '@/lib/config/auth';
import { clearFailures, isLockedOut, rateLimit, registerFailure, resetLockoutsForTests } from './rate-limit';

beforeEach(() => resetLockoutsForTests());

describe('login lockout', () => {
  it('5 failures lock the email for 15 minutes, also for an unknown email', () => {
    const t0 = 10_000_000;
    for (let i = 0; i < 4; i += 1) registerFailure('nobody@example.com', t0 + i);
    expect(isLockedOut('nobody@example.com', t0 + 5).locked).toBe(false);
    registerFailure('nobody@example.com', t0 + 4);
    const locked = isLockedOut('nobody@example.com', t0 + 10);
    expect(locked.locked).toBe(true);
    expect(locked.retryAfterSeconds).toBeGreaterThan(0);
    expect(locked.retryAfterSeconds).toBeLessThanOrEqual(900);
    expect(isLockedOut('other@example.com', t0 + 10).locked).toBe(false);
  });

  it('the lock ends 15 minutes after the last failure', () => {
    const t0 = 20_000_000;
    for (let i = 0; i < LOGIN_LOCKOUT.maxFailures; i += 1) registerFailure('a@example.com', t0);
    expect(isLockedOut('a@example.com', t0 + LOGIN_LOCKOUT.windowMs - 1).locked).toBe(true);
    expect(isLockedOut('a@example.com', t0 + LOGIN_LOCKOUT.windowMs).locked).toBe(false);
  });

  it('a success clears the counter', () => {
    const t0 = 30_000_000;
    for (let i = 0; i < 4; i += 1) registerFailure('b@example.com', t0);
    clearFailures('b@example.com');
    registerFailure('b@example.com', t0 + 1);
    expect(isLockedOut('b@example.com', t0 + 2).locked).toBe(false);
  });

  it('failures older than the window do not count towards the lock', () => {
    const t0 = 40_000_000;
    for (let i = 0; i < 4; i += 1) registerFailure('c@example.com', t0);
    registerFailure('c@example.com', t0 + LOGIN_LOCKOUT.windowMs);
    expect(isLockedOut('c@example.com', t0 + LOGIN_LOCKOUT.windowMs + 1).locked).toBe(false);
  });
});

describe('per-IP limits from the table', () => {
  const cases = [
    ['loginIp', 20],
    ['registerIp', 5],
    ['forgotPasswordIp', 5],
    ['forgotPasswordEmail', 3],
    ['resetPasswordIp', 10],
  ] as const;
  it.each(cases)('%s allows %i then blocks with a retry-after', (name, limit) => {
    const rule = RATE_LIMITS[name];
    expect(rule.limit).toBe(limit);
    const t0 = 50_000_000;
    for (let i = 0; i < limit; i += 1) expect(rateLimit(`test:${name}`, rule, t0).ok).toBe(true);
    const blocked = rateLimit(`test:${name}`, rule, t0 + 1);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(rateLimit(`test:${name}`, rule, t0 + rule.windowMs).ok).toBe(true);
  });
});
