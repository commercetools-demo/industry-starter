import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unstable_serialize } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keyChannels } from '@/lib/cache-keys';
import type { Cart } from '@/lib/types';
import { STORE_BK, STORE_SOHO, cad, usd, viewCart, viewLine } from '@/test/cart';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import CartDrawer from '@/components/cart/CartDrawer';
import { useShellUi } from '@/context/shell-ui-context';

afterEach(() => vi.unstubAllGlobals());

function Opener() {
  const { openCart, cartOpen } = useShellUi();
  return (
    <>
      <button onClick={openCart}>open bag</button>
      <p data-testid="open-state">{String(cartOpen)}</p>
    </>
  );
}

type Routes = Parameters<typeof stubFetch>[0];
function setup(cart: Cart | null, routes: Routes = {}, locale = 'en-US') {
  // The stub matches by URL prefix in key order: the test's own (more specific) routes come first and win.
  const defaults: Routes = {
    '/api/cart/count': () => ({ count: cart?.count ?? 0 }),
    '/api/channels': () => ({ stores: [STORE_SOHO, STORE_BK], selectedKey: null }),
    '/api/cart': () => ({ cart }),
  };
  const stub = stubFetch({ ...routes, ...Object.fromEntries(Object.entries(defaults).filter(([k]) => !(k in routes))) });
  const result = renderShell(
    <>
      <Opener />
      <CartDrawer />
    </>,
    { locale, fallback: { [unstable_serialize(keyChannels(locale === 'en-US' ? 'US' : 'CA'))]: { stores: [STORE_SOHO, STORE_BK], selectedKey: null } } },
  );
  return { stub, ...result };
}
const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'open bag' }));
  return screen.getByRole('dialog', { hidden: true });
};

const pod = viewLine({ id: 'a', quantity: 1, unitPrice: usd(1000) });
const mixed = () =>
  viewCart([
    viewLine({ id: 'c', fulfilment: 'collect', store: STORE_SOHO, unitPrice: usd(1000) }),
    viewLine({ id: 'd', fulfilment: 'delivery', unitPrice: usd(2000) }),
    viewLine({ id: 's', fulfilment: 'subscribe', unitPrice: usd(1500), recurrence: { policyId: 'rp', schedule: { unit: 'Weeks', value: 2 } } }),
  ]);

describe('CartDrawer', () => {
  it('Canada drawer shows only delivery and subscription lines and no collect cluster', async () => {
    const cart = viewCart(
      [
        viewLine({ id: 'd', fulfilment: 'delivery', unitPrice: cad(2000) }),
        viewLine({ id: 's', fulfilment: 'subscribe', unitPrice: cad(1500), recurrence: { policyId: 'rp', schedule: { unit: 'Weeks', value: 2 } } }),
      ],
      { currency: 'CAD', country: 'CA' },
    );
    setup(cart, {}, 'en-CA');
    const dialog = await open();
    expect(within(dialog).queryByText(/Collect/)).toBeNull();
    expect(dialog.querySelector('[data-group^="collect"]')).toBeNull();
  });

  it('Below the threshold shows Add remaining for free shipping with a teal bar', async () => {
    setup(viewCart([viewLine({ id: 'a', fulfilment: 'delivery', unitPrice: usd(2000) })]));
    await open();
    expect(await screen.findByText('Add $55.00 for free shipping')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '27');
    expect(bar.firstElementChild).toHaveClass('bg-teal');
  });

  it('Threshold reached shows unlocked line', async () => {
    setup(viewCart([viewLine({ id: 'a', fulfilment: 'delivery', unitPrice: usd(8000) })]));
    await open();
    expect(await screen.findByText("You've unlocked free shipping")).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('collection lines do not count towards free shipping', async () => {
    setup(viewCart([viewLine({ id: 'a', fulfilment: 'collect', store: STORE_SOHO, unitPrice: usd(9000) })]));
    await open();
    await screen.findByText('Subtotal');
    expect(screen.queryByText(/for free shipping/)).toBeNull();
    expect(screen.queryByText("You've unlocked free shipping")).toBeNull();
  });

  it('shows the header count, the subtotal and the two buttons', async () => {
    setup(viewCart([pod, viewLine({ id: 'b', quantity: 2 })]));
    const dialog = await open();
    expect(await within(dialog).findByRole('heading', { name: 'Your bag (3)' })).toBeInTheDocument();
    expect(screen.getByTestId('drawer-subtotal')).toHaveTextContent('$30.00');
    expect(screen.getByRole('link', { name: 'View bag' })).toHaveAttribute('href', '/cart');
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/checkout');
  });

  it('Quantity floor keeps 1 and removal only through Remove', async () => {
    const { stub } = setup(viewCart([pod]));
    await open();
    const minus = await screen.findByRole('button', { name: 'Decrease quantity' });
    expect(minus).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(minus);
    expect(stub.calls.some((c) => c.init?.method)).toBe(false);
    expect(screen.getByRole('button', { name: /^Remove / })).toBeInTheDocument();
  });

  it('Last line removed shows empty state without closing', async () => {
    const empty = viewCart([], { id: 'cart-1' });
    const { stub } = setup(viewCart([pod]), { '/api/cart/lines/a': () => ({ cart: empty }) });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: /^Remove / }));
    expect(await screen.findByText('Your bag is empty')).toBeInTheDocument();
    expect(screen.getByTestId('open-state')).toHaveTextContent('true');
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('data-open', 'true');
    expect(stub.calls.find((c) => c.url === '/api/cart/lines/a')?.init?.method).toBe('DELETE');
    // Focus lands on the empty state's button.
    await waitFor(() => expect(screen.getByRole('link', { name: 'Start shopping' })).toHaveFocus());
  });

  it('empty drawer Start shopping', async () => {
    setup(null);
    await open();
    const cta = await screen.findByRole('link', { name: 'Start shopping' });
    expect(cta).toHaveAttribute('href', '/shop');
    await userEvent.click(cta);
    expect(screen.getByTestId('open-state')).toHaveTextContent('false');
  });

  it('Price changed shows the new price with Price updated', async () => {
    const line = viewLine({ id: 'a', unitPrice: usd(1200), notices: [{ kind: 'price-updated', previous: usd(1000) }] });
    setup(viewCart([line]));
    await open();
    expect(await screen.findByText('Price updated')).toBeInTheDocument();
    expect(screen.getByTestId('line-total')).toHaveTextContent('$12.00');
  });

  it('fulfilment line text per fulfilment inside its cluster', async () => {
    setup(mixed());
    await open();
    expect(await screen.findByText('Collect at Malva SoHo')).toBeInTheDocument();
    expect(screen.getByText('Ship to me')).toBeInTheDocument();
    expect(screen.getByText('Delivers every 2 weeks')).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Collect · Malva SoHo', 'Shipping to you', 'Subscriptions']);
    // every line carries a mark and sits in the section of its own cluster
    const marks = screen.getAllByTestId('fulfilment-badge');
    expect(marks.map((m) => m.getAttribute('data-fulfilment'))).toEqual(['collect', 'delivery', 'subscribe']);
    for (const m of marks) expect(m.closest('section')).not.toBeNull();
  });

  it('no optimistic totals while pending', async () => {
    let release: (v: unknown) => void = () => undefined;
    const gate = new Promise((r) => (release = r));
    const bigger = viewCart([viewLine({ id: 'a', quantity: 2, unitPrice: usd(1000) })]);
    setup(viewCart([pod]), { '/api/cart/lines/a': async () => { await gate; return { cart: bigger }; } });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity' }));
    const line = screen.getByTestId('line-total').closest('li')!;
    await waitFor(() => expect(line).toHaveAttribute('aria-busy', 'true'));
    expect(screen.getByTestId('line-total')).toHaveTextContent('$10.00'); // the previous engine value
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toHaveAttribute('aria-disabled', 'true');
    release(undefined);
    await waitFor(() => expect(screen.getByTestId('line-total')).toHaveTextContent('$20.00'));
    expect(line).not.toHaveAttribute('aria-busy');
  });

  it('a stock refusal says how many are available', async () => {
    setup(viewCart([pod]), {
      '/api/cart/lines/a': () => Response.json({ error: { code: 'quantity_exceeds_stock', message: 'x', available: 1 } }, { status: 409 }),
    });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity' }));
    expect(await screen.findByTestId('cart-message')).toHaveTextContent('Only 1 available');
  });

  it('a collect line out of stock offers Ship, and shipping moves it', async () => {
    const stuck = viewLine({ id: 'c', fulfilment: 'collect', store: STORE_SOHO, notices: [{ kind: 'collect-unavailable' }] });
    const shipped = viewCart([viewLine({ id: 'c', fulfilment: 'delivery' })]);
    const { stub } = setup(viewCart([stuck]), { '/api/cart/lines/c': () => ({ cart: shipped }) });
    await open();
    expect(await screen.findByText('Not in stock at Malva SoHo, try shipping')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ship instead' }));
    await waitFor(() => expect(screen.queryByText(/Not in stock/)).toBeNull());
    expect(JSON.parse(String(stub.calls.find((c) => c.init?.method === 'PATCH')?.init?.body))).toEqual({ fulfilment: 'delivery' });
  });

  it('below the minimum order the shortfall replaces Checkout', async () => {
    const cart = viewCart([pod], { blockers: ['below-minimum'], canCheckout: false, minimumOrder: { value: usd(3000), shortfall: usd(2000) } });
    setup(cart);
    await open();
    expect(await screen.findByText('Add $20.00 to reach the $30.00 minimum order')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Checkout' })).toBeNull();
  });

  it('a blocked checkout says why and does not navigate', async () => {
    const cart = viewCart([viewLine({ id: 'a', notices: [{ kind: 'out-of-stock' }] })], { blockers: ['out-of-stock'], canCheckout: false });
    setup(cart);
    await open();
    const checkout = await screen.findByRole('link', { name: 'Checkout' });
    expect(checkout).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Remove or replace out-of-stock items to check out')).toBeInTheDocument();
  });

  it('shows an error with Retry when the bag cannot be loaded', async () => {
    let fail = true;
    setup(viewCart([pod]), { '/api/cart': () => (fail ? Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }) : { cart: viewCart([pod]) }) });
    await open();
    expect(await screen.findByText("We couldn't load your bag")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Subtotal')).toBeInTheDocument();
  });

  it('focus moves to the close button, Escape closes', async () => {
    setup(viewCart([pod]));
    const dialog = await open();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Close panel' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('open-state')).toHaveTextContent('false');
  });

  it('Tab stays inside the drawer', async () => {
    setup(mixed());
    const dialog = await open();
    await screen.findByText('Subtotal');
    for (let i = 0; i < 40; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('does not read the cart until it is opened', () => {
    const { stub } = setup(viewCart([pod]));
    expect(stub.calls.some((c) => c.url === '/api/cart')).toBe(false);
  });

  it('no axe violations', async () => {
    const { container } = setup(mixed());
    await open();
    await screen.findByText('Subtotal');
    await expectNoAxeViolations(container.ownerDocument.body);
  });
});
