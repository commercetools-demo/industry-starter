import { RATE_LIMITS } from '@/lib/config/rateLimits';
import { clientKey, rateLimit } from './rate-limit';

describe('rateLimit', () => {
  it('blocks the 11th login within a minute', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i += 1) expect(rateLimit('a:login', RATE_LIMITS.login, t0 + i).ok).toBe(true);
    const blocked = rateLimit('a:login', RATE_LIMITS.login, t0 + 10);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('resets after the window', () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 5; i += 1) rateLimit('b:register', RATE_LIMITS.register, t0);
    expect(rateLimit('b:register', RATE_LIMITS.register, t0 + 1).ok).toBe(false);
    expect(rateLimit('b:register', RATE_LIMITS.register, t0 + RATE_LIMITS.register.windowMs).ok).toBe(true);
  });

  it('keeps keys independent', () => {
    const t0 = 3_000_000;
    for (let i = 0; i < 5; i += 1) rateLimit('c:x', { limit: 5, windowMs: 1000 }, t0);
    expect(rateLimit('c:x', { limit: 5, windowMs: 1000 }, t0).ok).toBe(false);
    expect(rateLimit('d:x', { limit: 5, windowMs: 1000 }, t0).ok).toBe(true);
  });
});

describe('clientKey', () => {
  const req = (headers: Record<string, string>) => new Request('http://localhost/x', { headers });

  it('prefers x-nf-client-connection-ip, then the first x-forwarded-for entry, then unknown', () => {
    expect(clientKey(req({ 'x-nf-client-connection-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }), 'login')).toBe('1.1.1.1:login');
    expect(clientKey(req({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' }), 'login')).toBe('2.2.2.2:login');
    expect(clientKey(req({}), 'login')).toBe('unknown:login');
  });
});
