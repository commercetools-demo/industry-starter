import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';

const replace = vi.fn();
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));
const checkoutFlow = vi.fn();
vi.mock('@commercetools/checkout-browser-sdk', () => ({ checkoutFlow: (options: unknown) => checkoutFlow(options) }));

import { CheckoutFlow, sdkLocale } from './CheckoutFlow';

type Options = { projectKey: string; region: string; sessionId: string; locale: string; onInfo: (m: unknown) => void };
const session = { sessionId: 'sess-1', projectKey: 'proj', region: 'us-central1.gcp' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchMock = vi.fn();

const sdkOptions = async (): Promise<Options> => {
  await waitFor(() => expect(checkoutFlow).toHaveBeenCalled());
  return checkoutFlow.mock.calls[0][0] as Options;
};
const created = { code: 'checkout_completed', payload: { order: { id: 'order-1' } } };

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('CheckoutFlow', () => {
  it('requests the session once and starts the SDK with the session, region and locale; mounts inline', async () => {
    fetchMock.mockResolvedValue(json(session));
    const { container } = renderWithProviders(<CheckoutFlow />, { locale: 'en-US' });
    const options = await sdkOptions();
    expect(options).toMatchObject({ projectKey: 'proj', region: 'us-central1.gcp', sessionId: 'sess-1', locale: 'en-US' });
    expect(container.querySelector('[data-ctc]')).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/checkout/session');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');
    expect(checkoutFlow).toHaveBeenCalledTimes(1);
  });

  it('German shoppers get the SDK locale "de"', async () => {
    fetchMock.mockResolvedValue(json(session));
    renderWithProviders(<CheckoutFlow />, { locale: 'de-DE' });
    expect((await sdkOptions()).locale).toBe('de');
    expect(sdkLocale('en-US')).toBe('en-US');
  });

  it.each(['SLOT_FULL', 'UNAVAILABLE_LINES', 'NO_SLOT'])('session error %s: back to the bag with checkoutError', async (code) => {
    fetchMock.mockResolvedValue(json({ error: code }, 409));
    renderWithProviders(<CheckoutFlow />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/cart?checkoutError=${code}`));
    expect(checkoutFlow).not.toHaveBeenCalled();
  });

  it('network failure: back to the bag with NETWORK', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    renderWithProviders(<CheckoutFlow />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/cart?checkoutError=NETWORK'));
  });

  it('order-created message: completes on the server once, then opens the confirmation page', async () => {
    fetchMock.mockImplementation(async (url: string) => (url === '/api/checkout/session' ? json(session) : json({ orderId: 'order-1' })));
    renderWithProviders(<CheckoutFlow />);
    const { onInfo } = await sdkOptions();
    onInfo({ code: 'payment_started' });
    onInfo(created);
    onInfo({ code: 'order_created', payload: { order: { id: 'order-1' } } });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/checkout/confirmation/order-1'));
    const completeCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/checkout/complete');
    expect(completeCalls).toHaveLength(1);
    expect(JSON.parse((completeCalls[0][1] as RequestInit).body as string)).toEqual({ orderId: 'order-1' });
  });

  it('complete fails: shows a retry; retry succeeds and navigates', async () => {
    let completeCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/checkout/session') return json(session);
      completeCalls += 1;
      return completeCalls === 1 ? json({ error: 'CHECKOUT_ERROR' }, 500) : json({ orderId: 'order-1' });
    });
    renderWithProviders(<CheckoutFlow />);
    (await sdkOptions()).onInfo(created);
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(replace).not.toHaveBeenCalled();
    await userEvent.click(retry);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/checkout/confirmation/order-1'));
  });
});
