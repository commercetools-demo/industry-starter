// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

let n = 0;
const post = (body: unknown, ip = `10.0.0.${++n}`) =>
  POST(new Request('http://localhost/api/contact', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) }));

const valid = { name: 'Ada Lovelace', email: 'ada@example.com', topic: 'order', message: 'Where is my order, please?' };

afterEach(() => vi.restoreAllMocks());

describe('POST /api/contact', () => {
  it('Valid submit: ok and the log has topic and length only (no PII)', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith('contact', { topic: 'order', length: valid.message.length });
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).not.toContain('Ada');
    expect(logged).not.toContain('ada@example.com');
    expect(logged).not.toContain('Where is my order');
  });

  it('Invalid email: 400 with the field error, nothing logged', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await post({ ...valid, email: 'nope' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'VALIDATION', fields: { email: 'invalidEmail' } });
    expect(info).not.toHaveBeenCalled();
  });

  it('message too short: 400', async () => {
    const res = await post({ ...valid, message: 'short' });
    expect(res.status).toBe(400);
    expect((await res.json()).fields.message).toBe('tooShort');
  });

  it('honeypot filled: silent ok, nothing logged', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await post({ ...valid, website: 'http://spam.example' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(info).not.toHaveBeenCalled();
  });

  it('malformed JSON: 400', async () => {
    const res = await POST(new Request('http://localhost/api/contact', { method: 'POST', body: '{' }));
    expect(res.status).toBe(400);
  });

  it('rate limited: 429 with Retry-After after the limit', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const ip = '203.0.113.9';
    for (let i = 0; i < 5; i++) expect((await post(valid, ip)).status).toBe(200);
    const res = await post(valid, ip);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await res.json()).toEqual({ error: 'RATE_LIMITED' });
  });
});
