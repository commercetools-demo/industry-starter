// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const post = (body: unknown) =>
  POST(new Request('http://x/api/faq-feedback', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), {
    params: Promise.resolve({}),
  });
const VOTE = { questionId: 'ordering-shipping-cost', helpful: false, locale: 'en-US' };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/faq-feedback', () => {
  it('unknown question id is 400', async () => {
    for (const body of [{ ...VOTE, questionId: 'nope' }, { ...VOTE, helpful: 'yes' }, 'not json', {}]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('bad_request');
    }
  });

  it('without a receiver it logs one line and answers 202', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', '');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await post(VOTE);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ recorded: true });
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({ route: 'faq-feedback', questionId: 'ordering-shipping-cost', helpful: false });
  });

  it('no personal data is logged', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', '');
    const spies = [vi.spyOn(console, 'log').mockImplementation(() => {}), vi.spyOn(console, 'error').mockImplementation(() => {})];
    await post({ ...VOTE, email: 'maya@example.com', name: 'Maya' });
    for (const s of spies) expect(JSON.stringify(s.mock.calls)).not.toMatch(/maya/i);
  });

  it('feedback is forwarded to the configured receiver', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', 'https://receiver.example/votes');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await post({ ...VOTE, email: 'maya@example.com' });
    expect(res.status).toBe(202);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://receiver.example/votes');
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(sent).toMatchObject(VOTE);
    expect(sent).not.toHaveProperty('email');
  });

  it('a failing receiver is 502 and never recorded', async () => {
    vi.stubEnv('FEEDBACK_WEBHOOK_URL', 'https://receiver.example/votes');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('no', { status: 500 })));
    const res = await post(VOTE);
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe('upstream_unavailable');
  });
});
