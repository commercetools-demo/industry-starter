// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { config, runScheduled } from '../functions/auto-refill-run';

const SECRET = 'a-secret-of-16-chars-or-more';
const env = { AUTO_REFILL_RUN_SECRET: SECRET, URL: 'https://shop.example' };
const scheduled = () => new Request('https://shop.example/.netlify/functions/auto-refill-run', { method: 'POST', body: JSON.stringify({ next_run: '2026-11-08T05:00:00Z' }) });
const manual = (headers: Record<string, string> = {}) => new Request('https://shop.example/.netlify/functions/auto-refill-run', { method: 'POST', headers });

describe('subscriptions-and-recurring-orders: the Netlify scheduled function', () => {
  it('is scheduled daily', () => {
    expect(config.schedule).toBe('0 5 * * *');
  });

  it('a scheduler call posts to the app with the secret header and relays the counts', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ checked: { allowed: 1 } }), { status: 200 }));
    const r = await runScheduled(scheduled(), env, fetchImpl as never);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ checked: { allowed: 1 } });
    expect(fetchImpl).toHaveBeenCalledWith('https://shop.example/api/internal/auto-refill-run', { method: 'POST', headers: { 'x-refill-secret': SECRET } });
  });

  it('a public call without the secret is refused and nothing is called', async () => {
    const fetchImpl = vi.fn();
    expect((await runScheduled(manual(), env, fetchImpl as never)).status).toBe(401);
    expect((await runScheduled(manual({ 'x-refill-secret': 'wrong' }), env, fetchImpl as never)).status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a manual call with the secret runs (local invoke)', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    expect((await runScheduled(manual({ 'x-refill-secret': SECRET }), env, fetchImpl as never)).status).toBe(200);
  });

  it('without a configured secret (or a short one) or a site URL it is disabled', async () => {
    const fetchImpl = vi.fn();
    expect((await runScheduled(scheduled(), { URL: 'https://shop.example' }, fetchImpl as never)).status).toBe(503);
    expect((await runScheduled(scheduled(), { ...env, AUTO_REFILL_RUN_SECRET: 'short' }, fetchImpl as never)).status).toBe(503);
    expect((await runScheduled(scheduled(), { AUTO_REFILL_RUN_SECRET: SECRET }, fetchImpl as never)).status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('an app failure or a network failure is reported as 502 and never leaks the secret', async () => {
    const bad = vi.fn(async () => new Response('x', { status: 500 }));
    const down = vi.fn(async () => { throw new Error(`connect ${SECRET}`); });
    const a = await runScheduled(scheduled(), env, bad as never);
    const b = await runScheduled(scheduled(), env, down as never);
    expect([a.status, b.status]).toEqual([502, 502]);
    expect(await b.text()).not.toContain(SECRET);
  });
});
