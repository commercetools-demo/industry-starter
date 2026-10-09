// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log, redact, redactString } from './log';

describe('error-pages › Upstream fault: logs carry no health data', () => {
  it('drops fields named reason, results, value, sig, email and phone at any depth', () => {
    const out = redact({
      status: 500,
      reason: 'chest pain',
      nested: { Results: [{ a: 1 }], value: 'x', sig: 'abc', Email: 'a@b.co', phone: '555', keep: 'ok' },
      list: [{ phone: '1', id: 'k' }],
    });
    expect(out).toEqual({ status: 500, nested: { keep: 'ok' }, list: [{ id: 'k' }] });
  });

  it('drops request bodies, headers and credentials', () => {
    const out = redact({ method: 'POST', body: '{"reason":"x"}', headers: { authorization: 'Bearer z' }, password: 'p' });
    expect(out).toEqual({ method: 'POST' });
  });

  it('strips query strings and e-mail addresses from strings', () => {
    expect(redactString('GET /api/orders?reason=asthma&sig=abc failed')).toBe('GET /api/orders failed');
    expect(redactString('user jane.doe@example.com not found')).toBe('user [email] not found');
    expect(redact({ url: 'https://x.test/p?token=1#frag' })).toEqual({ url: 'https://x.test/p' });
  });

  it('reduces an Error to its class and status (the message may echo a body)', () => {
    const error = Object.assign(new TypeError('bad body {"reason":"asthma"}'), { statusCode: 502 });
    expect(redact(error)).toEqual({ name: 'TypeError', status: 502 });
  });

  it('survives cycles and deep nesting', () => {
    const a: Record<string, unknown> = { id: 1 };
    a.self = a;
    expect(() => redact(a)).not.toThrow();
    expect(JSON.stringify(redact(a))).toContain('[redacted]');
  });

  describe('log', () => {
    const spy = vi.spyOn(console, 'error');
    beforeEach(() => spy.mockImplementation(() => undefined));
    afterEach(() => spy.mockReset());

    it('writes a scoped line with redacted fields only', () => {
      log.error('api', 'failed for a@b.co?x=1', { reason: 'secret', status: 500 });
      expect(spy).toHaveBeenCalledWith('[api] failed for [email]', { status: 500 });
      const printed = JSON.stringify(spy.mock.calls);
      expect(printed).not.toContain('secret');
    });
  });
});
