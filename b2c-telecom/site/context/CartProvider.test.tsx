import { useEffect } from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { CartProvider, useCartContext, type CartContextValue } from './CartProvider';

const holder: { ctx?: CartContextValue } = {};
function Probe() {
  const value = useCartContext();
  useEffect(() => {
    holder.ctx = value;
  });
  return null;
}

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
const cart = { id: 'c', version: 2, itemCount: 1, lines: [{ offerKey: 'malva-offer-cable-500', kind: 'plan', name: 'Cable 500' }] };

afterEach(() => vi.unstubAllGlobals());

describe('CartProvider.addLineWithToast', () => {
  it('shows the toast "{name} added to your bundle" with a View bundle action and returns true', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (url === '/api/cart' ? reply(200, { cart: null }) : reply(200, { cart }))));
    renderWithProviders(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    let ok = false;
    await act(async () => {
      ok = (await holder.ctx?.addLineWithToast({ offerKey: 'malva-offer-cable-500', sku: 'S' })) ?? false;
    });
    expect(ok).toBe(true);
    expect(await screen.findByText('Cable 500 added to your bundle')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View bundle' })).toHaveAttribute('href', '/en-US/bundle');
  });

  it('a refusal calls onBlocked, shows no success toast and returns false', async () => {
    const blocked = { kind: 'incompatible', offerKey: 'o', reasons: [] };
    vi.stubGlobal('fetch', vi.fn((url: string) => (url === '/api/cart' ? reply(200, { cart: null }) : reply(409, { error: { code: 'OFFER_BLOCKED', message: 'x', details: blocked }, cart }))));
    const onBlocked = vi.fn();
    renderWithProviders(
      <CartProvider onBlocked={onBlocked}>
        <Probe />
      </CartProvider>,
    );
    let ok = true;
    await act(async () => {
      ok = (await holder.ctx?.addLineWithToast({ offerKey: 'o', sku: 'S' })) ?? true;
    });
    expect(ok).toBe(false);
    expect(onBlocked).toHaveBeenCalledWith(blocked, { offerKey: 'o', sku: 'S' });
    expect(screen.queryByText(/added to your bundle/)).not.toBeInTheDocument();
  });

  it('any other failure shows the error toast and never throws', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (url === '/api/cart' ? reply(200, { cart: null }) : reply(502, { error: { code: 'UPSTREAM_ERROR', message: 'x' } }))));
    renderWithProviders(
      <CartProvider>
        <Probe />
      </CartProvider>,
    );
    await act(async () => {
      expect(await holder.ctx?.addLineWithToast({ offerKey: 'o', sku: 'S' })).toBe(false);
    });
    await waitFor(() => expect(screen.getByText('Something went wrong. Your bundle was not changed.')).toBeInTheDocument());
  });
});
