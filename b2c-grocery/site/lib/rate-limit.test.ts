// @vitest-environment node
import { clientKey, rateLimit } from './rate-limit';

describe('rateLimit', () => {
  const opts = { limit: 2, windowMs: 1000 };

  it('enforces the limit and reports retryAfterSeconds > 0', () => {
    expect(rateLimit('a', opts, 0).ok).toBe(true);
    expect(rateLimit('a', opts, 1).ok).toBe(true);
    const blocked = rateLimit('a', opts, 2);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets after the window', () => {
    rateLimit('b', opts, 0); rateLimit('b', opts, 0);
    expect(rateLimit('b', opts, 0).ok).toBe(false);
    expect(rateLimit('b', opts, 1001).ok).toBe(true);
  });

  it('keeps keys independent', () => {
    rateLimit('c', opts, 0); rateLimit('c', opts, 0);
    expect(rateLimit('c', opts, 0).ok).toBe(false);
    expect(rateLimit('d', opts, 0).ok).toBe(true);
  });
});

describe('clientKey', () => {
  const req = (h: Record<string, string>) => new Request('http://x', { headers: h });
  it('prefers the Netlify IP, then the first x-forwarded-for, then unknown', () => {
    expect(clientKey(req({ 'x-nf-client-connection-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }), 'login')).toBe('login:1.1.1.1');
    expect(clientKey(req({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' }), 'login')).toBe('login:2.2.2.2');
    expect(clientKey(req({}), 'login')).toBe('login:unknown');
  });
});
