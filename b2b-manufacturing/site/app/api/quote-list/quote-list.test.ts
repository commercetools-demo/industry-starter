// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allServices, plumbingServices } from '@/components/service/test-fixtures';
import { createFakeCarts } from '../../../test/fake-carts';
import { mockSession, sessionMock } from '../../../test/api-helpers';

const world = createFakeCarts();
const save = vi.fn(async (s: Record<string, string>) => { sessionMock.current = s; });
const fetchAllServices = vi.fn(async () => allServices);
vi.mock('@/lib/session', () => ({ getSession: async () => sessionMock.current, saveSession: save }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: new Proxy({}, { get: (_t, p) => (world.root as Record<string, unknown>)[p as string] }) }));
vi.mock('@/lib/ct/services', () => ({ fetchAllServices }));
const { GET, POST } = await import('./route');
const { POST: POST_LINE } = await import('./lines/route');
const { PATCH, DELETE } = await import('./lines/[id]/route');
const { clearServicesMemo } = await import('@/lib/quote/list-api');

const drain = plumbingServices[1]!;
const req = (method: string, body?: unknown, headers: Record<string, string> = {}) => new Request('http://x/api/quote-list', { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => { world.carts.clear(); world.calls.length = 0; save.mockClear(); fetchAllServices.mockClear(); clearServicesMemo(); mockSession({ storeKey: 'mpw-web' }); });

describe('malva-quote-list › routes', () => {
  it('Persistence: an anonymous visitor with no list gets an empty list and nothing is called in commercetools', async () => {
    const res = await GET(req('GET'));
    expect(await res.json()).toEqual({ id: null, lines: [], count: 0 });
    expect(world.calls).toEqual([]);
    expect(fetchAllServices).not.toHaveBeenCalled();
  });
  it('Add a service: the full list comes back, the cart id is stored in the session, and a second add says alreadyInList', async () => {
    const res = await POST_LINE(req('POST', { serviceId: drain.id, frequency: 'annual' }));
    const list = await res.json();
    expect(res.status).toBe(200);
    expect(list).toMatchObject({ count: 1, lines: [{ serviceId: drain.id, frequency: 'annual' }] });
    expect(sessionMock.current.cartId).toBe(list.id);
    const again = await (await POST(req('POST', { serviceId: drain.id }))).json();
    expect(again).toMatchObject({ count: 1, alreadyInList: true });
    expect((await (await GET(req('GET'))).json()).count).toBe(1);
  });
  it('adds by slug as well (?service=<slug> on the request form)', async () => {
    const list = await (await POST_LINE(req('POST', { serviceSlug: drain.slug }))).json();
    expect(list.count).toBe(1);
  });
  it('rejects a body without a service (400), an unknown service (404) and an unsupported frequency (400), creating nothing', async () => {
    expect((await POST_LINE(req('POST', {}))).status).toBe(400);
    expect((await POST_LINE(req('POST', { serviceId: 'nope' }))).status).toBe(404);
    expect((await POST_LINE(req('POST', { serviceId: drain.id, frequency: 'weekly' }))).status).toBe(400);
    expect(world.carts.size).toBe(0);
  });
  it('Edit and remove: PATCH returns the updated list, DELETE the list without the line; Remove last service gives count 0', async () => {
    const added = await (await POST_LINE(req('POST', { serviceId: drain.id }))).json();
    const id = added.lines[0].id;
    const patched = await (await PATCH(req('PATCH', { frequency: 'one-off', note: 'Rear yard' }), ctx(id))).json();
    expect(patched.lines[0]).toMatchObject({ frequency: 'one-off', note: 'Rear yard' });
    expect((await PATCH(req('PATCH', {}), ctx(id))).status).toBe(400);
    expect((await PATCH(req('PATCH', { frequency: 'weekly' }), ctx(id))).status).toBe(400);
    const removed = await (await DELETE(req('DELETE'), ctx(id))).json();
    expect(removed).toMatchObject({ lines: [], count: 0 });
    expect((await DELETE(req('DELETE'), ctx('missing'))).status).toBe(404);
  });
  it('the page locale decides the currency: a USD session on a de-DE page gets an EUR list', async () => {
    const res = await POST_LINE(req('POST', { serviceId: drain.id }, { 'x-malva-locale': 'de-DE' }));
    expect((await res.json()).count).toBe(1);
    expect(sessionMock.current).toMatchObject({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
    expect([...world.carts.values()][0]!.totalPrice.currencyCode).toBe('EUR');
  });
  it('a signed-in client with a Business Unit gets the list through the associate chain', async () => {
    mockSession({ customerId: 'c1', businessUnitKey: 'mpw-co', storeKey: 'mpw-web' });
    await POST_LINE(req('POST', { serviceId: drain.id }));
    expect(world.calls.find((c) => c.op === 'create')!.api).toBe('associate');
  });
  it('failures never leak details: the body is { error } with a safe message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchAllServices.mockRejectedValueOnce(new Error('SDK-INTERNAL secret token'));
    const res = await POST_LINE(req('POST', { serviceId: drain.id }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/secret|token|SDK-INTERNAL/);
  });
});
