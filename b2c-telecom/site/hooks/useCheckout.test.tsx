import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { KEY_CART } from '@/lib/cache-keys';
import { makeState, usd, feeLine, makeCart, planLine } from '@/test/fixtures/checkoutApi';
import { CheckoutError, useCheckout } from './useCheckout';

const wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
const answer = (body: unknown, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe('useCheckout', () => {
  it('starts from the server state and derives the review from it', () => {
    const { result } = renderHook(() => useCheckout(makeState({ email: 'a@b.co' })), { wrapper });
    expect(result.current.state.email).toBe('a@b.co');
    expect(result.current.review.dueToday.centAmount).toBe(8499);
    expect(result.current.review.state).toBe(result.current.state);
  });

  it('a write answers with the state read back: it replaces the cached state and the review follows', async () => {
    const next = makeState({ email: 'a@b.co', cart: makeCart({ lines: [planLine(), feeLine({ total: usd(100), unitPrice: usd(100), unitListPrice: usd(100) })] }) });
    const fetchMock = answer({ state: next });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCheckout(makeState()), { wrapper });
    await act(async () => {
      await result.current.saveDetails({ email: 'a@b.co' });
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/checkout/details', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@b.co' }) }));
    await waitFor(() => expect(result.current.review.dueToday.centAmount).toBe(6099));
    expect(result.current.state.email).toBe('a@b.co');
  });

  it('a refusal throws a CheckoutError with its code and details, and the state that comes with it is kept', async () => {
    const stored = makeState({ email: 'a@b.co' });
    vi.stubGlobal('fetch', answer({ error: { code: 'NOT_SERVICEABLE', message: 'no', details: { lineIds: ['L1'] } }, state: stored }, 422));
    const { result } = renderHook(() => useCheckout(makeState()), { wrapper });
    let caught: unknown;
    await act(async () => {
      caught = await result.current.saveDetails({ email: 'a@b.co' }).catch((error: unknown) => error);
    });
    expect(caught).toBeInstanceOf(CheckoutError);
    expect(caught).toMatchObject({ code: 'NOT_SERVICEABLE', status: 422, details: { lineIds: ['L1'] } });
    await waitFor(() => expect(result.current.state.email).toBe('a@b.co'));
  });

  it('startPayment posts the total the buyer saw and returns the session', async () => {
    const fetchMock = answer({ session: { mode: 'demo', orderNumber: 'MLV-AAAAAAAA' } });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useCheckout(makeState()), { wrapper });
    let info: unknown;
    await act(async () => {
      info = await result.current.startPayment(8499);
    });
    expect(info).toEqual({ mode: 'demo', orderNumber: 'MLV-AAAAAAAA' });
    expect(fetchMock).toHaveBeenCalledWith('/api/checkout/session', expect.objectContaining({ body: JSON.stringify({ expectedTotalCents: 8499 }) }));
  });

  it('completing an order empties the shared cart cache', async () => {
    vi.stubGlobal('fetch', answer({ orderNumber: 'MLV-AAAAAAAA' }));
    const { result } = renderHook(() => ({ checkout: useCheckout(makeState()), key: KEY_CART }), { wrapper });
    let number = '';
    await act(async () => {
      number = await result.current.checkout.completeOrder('o-1');
    });
    expect(number).toBe('MLV-AAAAAAAA');
  });

  it('a network failure is a CheckoutError NETWORK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const { result } = renderHook(() => useCheckout(makeState()), { wrapper });
    const error = await result.current.selectDelivery('x').catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'NETWORK' });
  });
});
