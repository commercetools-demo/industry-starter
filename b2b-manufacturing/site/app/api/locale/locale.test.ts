// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { mockSession, sessionMock } from '../../../test/api-helpers';

const save = vi.fn();
const cookieSet = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: async () => sessionMock.current, saveSession: save }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: cookieSet }) }));
const rebuild = vi.fn<(session?: unknown) => Promise<{ cartId?: string; rebuilt: boolean }>>(async () => ({ rebuilt: false }));
vi.mock('@/lib/ct/quote-list', () => ({ rebuildQuoteList: (s: unknown) => rebuild(s) }));
const { POST } = await import('./route');
const post = (body: unknown) => POST(new Request('http://x/api/locale', { method: 'POST', body: JSON.stringify(body) }));

describe('malva-locale-routing › Quote list on switch', () => {
  it('starts the list again in EUR (new cart id kept in the session) and sets the notice cookie', async () => {
    mockSession({ cartId: 'k1' });
    rebuild.mockResolvedValueOnce({ cartId: 'k2', rebuilt: true });
    const res = await post({ locale: 'de-DE' });
    expect(rebuild).toHaveBeenLastCalledWith(expect.objectContaining({ currency: 'EUR', country: 'DE', cartId: 'k1' }));
    expect(await res.json()).toMatchObject({ quoteListRebuilt: true, cartReset: false });
    expect(save.mock.calls.at(-1)![0].cartId).toBe('k2');
    expect(cookieSet).toHaveBeenCalledWith('malva-ql-notice', '1', expect.objectContaining({ path: '/' }));
  });
  it('a failing rebuild still switches the locale and drops the cart', async () => {
    mockSession({ cartId: 'k1' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    rebuild.mockRejectedValueOnce(new Error('down'));
    const res = await post({ locale: 'de-DE' });
    expect(res.status).toBe(200);
    expect(save.mock.calls.at(-1)![0]).toMatchObject({ locale: 'de-DE', currency: 'EUR' });
    expect(save.mock.calls.at(-1)![0].cartId).toBeUndefined();
  });
  it('no rebuild when the currency does not change or there is no list', async () => {
    rebuild.mockClear();
    mockSession({ cartId: 'k1' }); await post({ locale: 'en-US' });
    mockSession({}); await post({ locale: 'de-DE' });
    expect(rebuild).not.toHaveBeenCalled();
  });
});

describe('malva-locale-routing › Region and language switch', () => {
  it('writes locale, currency and country together, updates the cookie and drops the cart on a currency change', async () => {
    mockSession({ cartId: 'k1' });
    const res = await post({ locale: 'de-DE' });
    expect(await res.json()).toMatchObject({ locale: 'de-DE', currency: 'EUR', country: 'DE', cartReset: true, previousCartId: 'k1' });
    const saved = save.mock.calls.at(-1)![0];
    expect(saved).toMatchObject({ locale: 'de-DE', currency: 'EUR', country: 'DE' });
    expect(saved.cartId).toBeUndefined();
    expect(cookieSet).toHaveBeenCalledWith('your-shop-country-locale', 'de-DE', expect.objectContaining({ path: '/' }));
  });
  it('keeps the cart when the currency does not change', async () => {
    mockSession({ cartId: 'k1' });
    await post({ locale: 'en-US' });
    expect(save.mock.calls.at(-1)![0].cartId).toBe('k1');
  });
  it('rejects an unsupported locale with 400 and writes nothing', async () => {
    save.mockClear();
    expect((await post({ locale: 'fr-FR' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });
});
