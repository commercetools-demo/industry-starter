// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/lib/contact/rate-limit';
import { FORWARD_TIMEOUT_MS } from '@/lib/contact/forward';
import { POST } from './route';

const VALID = {
  name: 'Maya Test',
  email: 'maya@example.com',
  topic: 'order',
  orderNumber: 'MC-10042',
  message: 'My capsules arrived damaged.',
  consent: true,
  website: '',
  locale: 'en-US',
};

const send = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request('http://x/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );

const okFetch = () => vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv('CONTACT_WEBHOOK_URL', 'https://receiver.example/in');
  vi.stubEnv('CONTACT_WEBHOOK_TOKEN', '');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('POST /api/contact', () => {
  it('Enquiry accepted downstream: 202 with reference and channel', async () => {
    vi.stubGlobal('fetch', okFetch());
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await send(VALID);
    expect(res.status).toBe(202);
    const body = (await res.json()) as { reference: string; channel: string };
    expect(body.channel).toBe('Customer care');
    expect(body.reference).toMatch(/^MC-\d{8}-[A-HJ-NP-Z2-9]{6}$/);
  });

  it('reference has the expected shape and the Canada channel is chosen by locale', async () => {
    vi.stubGlobal('fetch', okFetch());
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await send({ ...VALID, locale: 'en-CA' });
    const body = (await res.json()) as { reference: string; channel: string };
    expect(body.channel).toBe('Customer care (Canada)');
    expect(body.reference).toMatch(/^MC-\d{8}-[A-Z2-9]{6}$/);
  });

  it('payload sent to the receiver carries the reference', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('CONTACT_WEBHOOK_TOKEN', 'test-token-value');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await send(VALID);
    const { reference } = (await res.json()) as { reference: string };
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://receiver.example/in');
    const sent = JSON.parse(String(init.body)) as Record<string, string>;
    expect(sent).toMatchObject({ reference, topic: 'order', orderNumber: 'MC-10042', country: 'US', locale: 'en-US', email: 'maya@example.com' });
    expect(typeof sent.receivedAt).toBe('string');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-token-value');
  });

  it('Routing unavailable: receiver 500 returns 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('no', { status: 500 })));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await send(VALID);
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('contact_unavailable');
  });

  it('Routing unavailable: timeout returns 503', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
      ),
    );
    const pending = send(VALID);
    await vi.advanceTimersByTimeAsync(FORWARD_TIMEOUT_MS + 10);
    const res = await pending;
    expect(res.status).toBe(503);
  });

  it('Routing unavailable: a network error returns 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect((await send(VALID)).status).toBe(503);
  });

  it('no receiver configured returns 503', async () => {
    vi.stubEnv('CONTACT_WEBHOOK_URL', '');
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await send(VALID);
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honeypot is rejected', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await send({ ...VALID, website: 'http://spam.example' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('invalid input answers the safe invalid_request body without echoing values', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await send({ ...VALID, email: 'not-an-email-SECRETVALUE' });
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: 'invalid_request', message: 'The request could not be understood' } });
    expect(text).not.toContain('SECRETVALUE');
  });

  it('message over 2000 characters is rejected', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect((await send({ ...VALID, message: 'a'.repeat(2001) })).status).toBe(400);
    vi.stubGlobal('fetch', okFetch());
    expect((await send({ ...VALID, message: 'a'.repeat(2000) })).status).toBe(202);
  });

  it('sixth submission in ten minutes is 429', async () => {
    vi.stubGlobal('fetch', okFetch());
    vi.spyOn(console, 'log').mockImplementation(() => {});
    for (let i = 0; i < 5; i += 1) expect((await send(VALID)).status).toBe(202);
    const sixth = await send(VALID);
    expect(sixth.status).toBe(429);
    expect(Number(sixth.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await sixth.json()).error.code).toBe('rate_limited');
    // another client is not affected
    expect((await send(VALID, { 'x-forwarded-for': '198.51.100.9' })).status).toBe(202);
  });

  it('non-JSON body is 415', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await send('name=Maya', { 'content-type': 'text/plain' });
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe('unsupported_media_type');
  });

  it('logs never contain the message or email', async () => {
    vi.stubGlobal('fetch', okFetch());
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    for (const s of spies) s.mockImplementation(() => {});
    await send(VALID);
    await send({ ...VALID, message: 'x' });
    const all = JSON.stringify(spies.map((s) => s.mock.calls));
    for (const secret of ['maya@example.com', 'Maya Test', 'My capsules arrived damaged', 'MC-10042', '203.0.113.7']) {
      expect(all).not.toContain(secret);
    }
    expect(spies[0].mock.calls.length).toBe(2);
  });
});
