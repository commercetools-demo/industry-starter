import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { unstable_serialize } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keyChannels } from '@/lib/cache-keys';
import type { Cart, CartLine } from '@/lib/types';
import { STORE_BK, STORE_SOHO, cad, usd, viewCart, viewLine } from '@/test/cart';
import { expectNoAxeViolations } from '@/test/axe';
import { renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import CartPage from '@/components/cart/CartPage';
import StorePicker from '@/components/store/StorePicker';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T16:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Routes = Parameters<typeof stubFetch>[0];
interface Opts { locale?: string; selectedKey?: string | null; routes?: Routes; picker?: boolean }

function setup(initial: Cart | null, { locale = 'en-US', selectedKey = null, routes = {}, picker = false }: Opts = {}) {
  const us = locale === 'en-US';
  const channels = { stores: us ? [STORE_SOHO, STORE_BK] : [], selectedKey };
  const defaults: Routes = {
    '/api/cart/count': () => ({ count: initial?.count ?? 0 }),
    '/api/channels': () => channels,
    '/api/session/store': () => ({ storeKey: 'x' }),
    '/api/availability': () => ({ sku: 'x', ship: 'in', stores: [] }),
    '/api/cart': () => ({ cart: initial }),
  };
  const stub = stubFetch({ ...routes, ...Object.fromEntries(Object.entries(defaults).filter(([k]) => !(k in routes))) });
  const result = renderShell(
    <>
      <CartPage initialCart={initial} />
      {picker ? <StorePicker /> : null}
    </>,
    { locale, fallback: { [unstable_serialize(keyChannels(us ? 'US' : 'CA'))]: channels } },
  );
  return { stub, ...result };
}

const sub = (id: string, over: Partial<CartLine> = {}) =>
  viewLine({ id, fulfilment: 'subscribe', unitPrice: usd(1500), recurrence: { policyId: 'rp', schedule: { unit: 'Weeks', value: 2 } }, ...over });
const ship = (id: string, over: Partial<CartLine> = {}) => viewLine({ id, fulfilment: 'delivery', unitPrice: usd(2000), ...over });
const collect = (id: string, store = STORE_SOHO, over: Partial<CartLine> = {}) => viewLine({ id, fulfilment: 'collect', store, unitPrice: usd(1000), ...over });
const mixed = () => viewCart([sub('s'), ship('d'), collect('c')]);
const lineIn = (id: string) => document.querySelector(`[data-line-id="${id}"]`) as HTMLElement;
const clusterOf = (id: string) => lineIn(id).closest('[data-group]')?.getAttribute('data-group');

describe('cart page clusters (I-09)', () => {
  it('Mixed bag with collect, ship and subscribe lines shows three clusters each with its own heading and promise', () => {
    setup(mixed());
    expect(screen.getByRole('heading', { level: 1, name: 'Your bag' })).toBeInTheDocument();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Collect · Malva SoHo', 'Shipping to you', 'Subscriptions', 'Order summary']);
    expect(screen.getByText('1 Prince St, New York · ready in about 15 minutes')).toBeInTheDocument();
    expect(screen.getByText('Free standard over $75.00 · 2 to 4 business days')).toBeInTheDocument();
    expect(screen.getByText('Delivered on the schedule you chose')).toBeInTheDocument();
  });

  it('every line shows a fulfilment badge inside its cluster', () => {
    setup(mixed());
    for (const [id, text] of [['c', 'Collect · Malva SoHo'], ['d', 'Ships to you'], ['s', 'Every 2 weeks']] as const) {
      const row = lineIn(id);
      expect(within(row).getByTestId('fulfilment-badge')).toHaveTextContent(text);
      expect(row.closest('[data-group]')).not.toBeNull();
    }
    expect(clusterOf('c')).toBe('collect:mcf-store-nyc-soho');
    expect(clusterOf('d')).toBe('delivery');
    expect(clusterOf('s')).toBe('subscribe');
  });

  it('cluster order is collect stores then ship then subscribe, one cluster per store', () => {
    setup(viewCart([sub('s'), ship('d'), collect('c1'), collect('c2', STORE_BK)]));
    const order = Array.from(document.querySelectorAll('[data-group]')).map((g) => g.getAttribute('data-group'));
    expect(order).toEqual(['collect:mcf-store-nyc-soho', 'collect:mcf-store-brooklyn', 'delivery', 'subscribe']);
    expect(screen.getByRole('heading', { name: 'Collect · Malva Brooklyn' })).toBeInTheDocument();
  });

  it('switching one line moves only that line between clusters', async () => {
    const after = viewCart([sub('s'), ship('d'), ship('c', { sku: 'SKU-c' })]);
    const { stub } = setup(mixed(), { routes: { '/api/cart/lines/c': () => ({ cart: after }) } });
    await userEvent.click(within(lineIn('c')).getByRole('radio', { name: 'Ship' }));
    await waitFor(() => expect(clusterOf('c')).toBe('delivery'));
    expect(clusterOf('d')).toBe('delivery');
    expect(clusterOf('s')).toBe('subscribe');
    expect(document.querySelector('[data-group="collect:mcf-store-nyc-soho"]')).toBeNull(); // the empty cluster is gone
    expect(JSON.parse(String(stub.calls.find((c) => c.init?.method === 'PATCH')?.init?.body))).toEqual({ fulfilment: 'delivery' });
  });

  it('Switch to ship from a collect line out of stock moves it and clears the warning', async () => {
    const stuck = collect('c', STORE_SOHO, { notices: [{ kind: 'collect-unavailable' }] });
    setup(viewCart([stuck]), { routes: { '/api/cart/lines/c': () => ({ cart: viewCart([ship('c')]) }) } });
    expect(screen.getByText('Not in stock at Malva SoHo, try shipping')).toBeInTheDocument();
    await userEvent.click(within(lineIn('c')).getByRole('radio', { name: 'Ship' }));
    await waitFor(() => expect(screen.queryByText(/Not in stock/)).toBeNull());
    expect(clusterOf('c')).toBe('delivery');
  });

  it('Merge renders one line with the summed quantity', async () => {
    const merged = viewCart([ship('d', { quantity: 5, unitPrice: usd(1000) })]);
    setup(viewCart([ship('d', { quantity: 3, unitPrice: usd(1000) }), collect('c', STORE_SOHO, { quantity: 2 })]), {
      routes: { '/api/cart/lines/c': () => ({ cart: merged }) },
    });
    await userEvent.click(within(lineIn('c')).getByRole('radio', { name: 'Ship' }));
    await waitFor(() => expect(document.querySelectorAll('[data-line-id]')).toHaveLength(1));
    expect(within(lineIn('d')).getByLabelText('Quantity 5')).toBeInTheDocument();
  });

  it('collect chip disabled with title when the session store is out', () => {
    const line = ship('d', { collectAtSessionStore: { storeKey: STORE_SOHO.key, storeName: 'Malva SoHo', state: 'out' } });
    setup(viewCart([line]), { selectedKey: STORE_SOHO.key });
    const chip = within(lineIn('d')).getByRole('radio', { name: 'Collect' });
    expect(chip).toHaveAttribute('aria-disabled', 'true');
    expect(chip).toHaveAttribute('title', 'Not available for collection at Malva SoHo');
  });

  it('chips hidden for subscribe lines', () => {
    setup(viewCart([sub('s')]));
    expect(within(lineIn('s')).queryByRole('radiogroup')).toBeNull();
    expect(within(lineIn('s')).getByText('First delivery by Tue, Oct 27, then every 2 weeks')).toBeInTheDocument();
  });

  it('Canada bag has no Collect chip, no collect cluster and no collect badge', () => {
    const cart = viewCart([ship('d', { unitPrice: cad(2000) }), sub('s', { unitPrice: cad(1500) })], { currency: 'CAD', country: 'CA' });
    setup(cart, { locale: 'en-CA' });
    expect(screen.queryByRole('radio', { name: 'Collect' })).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(document.querySelector('[data-group^="collect"]')).toBeNull();
    expect(screen.queryByText(/Collect/)).toBeNull();
    expect(screen.getAllByTestId('fulfilment-badge').map((b) => b.getAttribute('data-fulfilment'))).toEqual(['delivery', 'subscribe']);
  });

  it('store_required opens the picker and retries', async () => {
    let first = true;
    const { stub } = setup(viewCart([ship('d')]), {
      picker: true,
      routes: {
        '/api/cart/lines/d': () => {
          if (first) {
            first = false;
            return Response.json({ error: { code: 'store_required', message: 'x' } }, { status: 409 });
          }
          return { cart: viewCart([collect('d', STORE_BK)]) };
        },
      },
    });
    await userEvent.click(within(lineIn('d')).getByRole('radio', { name: 'Collect' }));
    const dialog = await screen.findByRole('dialog', { name: /store/i });
    await userEvent.click(within(dialog).getByRole('radio', { name: /Malva Brooklyn/ }));
    await waitFor(() => expect(clusterOf('d')).toBe('collect:mcf-store-brooklyn'));
    const patches = stub.calls.filter((c) => c.init?.method === 'PATCH').map((c) => JSON.parse(String(c.init?.body)));
    expect(patches).toEqual([{ fulfilment: 'collect' }, { fulfilment: 'collect', storeKey: STORE_BK.key }]);
  });

  it('Change store moves the collect lines through PATCH /api/cart', async () => {
    const moved = viewCart([collect('c', STORE_BK)]);
    const { stub } = setup(viewCart([collect('c')]), { picker: true, selectedKey: STORE_SOHO.key, routes: { '/api/cart': (init) => (init?.method === 'PATCH' ? { cart: moved } : { cart: viewCart([collect('c')]) }) } });
    await userEvent.click(screen.getByRole('button', { name: 'Change store' }));
    const dialog = await screen.findByRole('dialog', { name: /store/i });
    await userEvent.click(within(dialog).getByRole('radio', { name: /Malva Brooklyn/ }));
    await waitFor(() => expect(clusterOf('c')).toBe('collect:mcf-store-brooklyn'));
    expect(JSON.parse(String(stub.calls.find((c) => c.url === '/api/cart' && c.init?.method === 'PATCH')?.init?.body))).toEqual({
      action: 'changeCollectionStore', storeKey: STORE_BK.key,
    });
  });

  it('initialCart renders without a spinner', () => {
    setup(mixed());
    expect(screen.queryByRole('status', { name: 'Loading your bag' })).toBeNull();
    expect(lineIn('c')).toBeInTheDocument();
  });

  it('shows an error with Retry when the bag cannot be read and there is no initial cart', async () => {
    stubFetch({
      '/api/cart/count': () => ({ count: 0 }), '/api/channels': () => ({ stores: [], selectedKey: null }),
      '/api/cart': () => Response.json({ error: { code: 'upstream_unavailable', message: 'x' } }, { status: 503 }),
    });
    renderShell(<CartPage />);
    expect(await screen.findByText("We couldn't load your bag")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('order summary (I-10)', () => {
  it('Tax presentation shows Estimated tax for US and for Canada (GST 5%) and Includes tax only when the rate is included in price', () => {
    const { unmount } = setup(viewCart([ship('d')], { tax: { amount: usd(160), included: false } }));
    expect(screen.getByText('Estimated tax')).toBeInTheDocument();
    expect(screen.getByText('$1.60')).toBeInTheDocument();
    unmount();

    const ca = viewCart([ship('d', { unitPrice: cad(2000) })], { currency: 'CAD', country: 'CA', tax: { amount: cad(100), included: false }, total: cad(2795), subtotal: cad(2000) });
    const second = setup(ca, { locale: 'en-CA' });
    expect(screen.getByText('Estimated tax')).toBeInTheDocument();
    expect(screen.getByText('$1.00')).toBeInTheDocument();
    expect(screen.getByTestId('order-total')).toHaveTextContent('$27.95');
    second.unmount();

    setup(viewCart([ship('d')], { tax: { amount: usd(160), included: true } }));
    expect(screen.getByText('Includes $1.60 tax')).toBeInTheDocument();
    expect(screen.queryByText('Estimated tax')).toBeNull();
  });

  it('Shipping reads Free or the engine amount or Calculated at checkout', () => {
    const a = setup(viewCart([ship('d')], { shipping: { amount: usd(0), isFree: true } }));
    expect(screen.getByText('Free')).toBeInTheDocument();
    a.unmount();
    const b = setup(viewCart([ship('d')], { shipping: { amount: usd(695), isFree: false } }));
    expect(screen.getByText('$6.95')).toBeInTheDocument();
    b.unmount();
    setup(viewCart([ship('d')], { shipping: null, tax: null }));
    expect(screen.getAllByText('Calculated at checkout')).toHaveLength(2);
  });

  it('shows the engine total and discount', () => {
    setup(viewCart([ship('d')], { total: usd(2345), discount: usd(200) }));
    expect(screen.getByTestId('order-total')).toHaveTextContent('$23.45');
    expect(screen.getByText('-$2.00')).toBeInTheDocument();
  });

  it('Empty cart shows the empty state with no summary block', () => {
    setup(viewCart([]));
    expect(screen.getByRole('heading', { level: 1, name: 'Your bag is empty' })).toBeInTheDocument();
    expect(screen.getByText("Let's find something to brew.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shop coffee' })).toHaveAttribute('href', '/category/coffee');
    expect(screen.queryByText('Order summary')).toBeNull();
    expect(screen.queryByTestId('order-total')).toBeNull();
  });

  it('a shopper without a cart sees the empty state', () => {
    setup(null);
    expect(screen.getByTestId('empty-cart')).toBeInTheDocument();
  });

  it('Removing the last line renders the empty state', async () => {
    setup(viewCart([ship('d')]), { routes: { '/api/cart/lines/d': () => ({ cart: viewCart([]) }) } });
    await userEvent.click(screen.getByRole('button', { name: /^Remove / }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your bag is empty' })).toBeInTheDocument();
    expect(screen.queryByText('Order summary')).toBeNull();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Shop coffee' })).toHaveFocus());
  });

  it('Below minimum order value hides Checkout and states the shortfall', () => {
    setup(viewCart([ship('d')], { blockers: ['below-minimum'], canCheckout: false, minimumOrder: { value: usd(3000), shortfall: usd(1000) } }));
    expect(screen.getByText('Add $10.00 to reach the $30.00 minimum order')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Checkout' })).toBeNull();
  });

  it('stock blockers disable Checkout with the reason', () => {
    setup(viewCart([ship('d', { notices: [{ kind: 'out-of-stock' }] })], { blockers: ['out-of-stock'], canCheckout: false }));
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Remove or replace out-of-stock items to check out')).toBeInTheDocument();
  });

  it('Starter capsules suggestion adds compatible capsules and totals update in place', async () => {
    const machine = viewCart([ship('m', { name: 'Vertuo Next', shape: 'machine', systemKey: 'vertuo' })], {
      nudge: { sku: 'V-10', name: 'Vertuo Dark', price: usd(1090), machineName: 'Vertuo Next' },
    });
    const withPods = viewCart([ship('m', { name: 'Vertuo Next' }), ship('p', { name: 'Vertuo Dark', unitPrice: usd(1090) })], { total: usd(9999) });
    let added = false;
    const { stub } = setup(machine, {
      routes: {
        '/api/cart/lines': () => {
          added = true;
          return { cart: { id: 'cart-1', version: 4, count: 2, lines: [] } };
        },
        '/api/cart': () => ({ cart: added ? withPods : machine }),
      },
    });
    expect(screen.getByText('Vertuo Next needs capsules. Add starter capsules?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add Vertuo Dark for $10.90' }));
    await waitFor(() => expect(screen.getByTestId('order-total')).toHaveTextContent('$99.99'));
    expect(screen.queryByTestId('companion-nudge')).toBeNull();
    expect(JSON.parse(String(stub.calls.find((c) => c.url === '/api/cart/lines')?.init?.body))).toEqual({ sku: 'V-10', quantity: 1, fulfilment: 'delivery' });
  });

  it('no nudge when the cart has none', () => {
    setup(viewCart([ship('d')]));
    expect(screen.queryByTestId('companion-nudge')).toBeNull();
  });

  it('sticky summary classes and mobile order', () => {
    setup(mixed());
    const summary = screen.getByRole('complementary');
    expect(summary).toHaveClass('stack:sticky', 'stack:top-24');
    const grid = summary.closest('.grid')!;
    expect(grid).toHaveClass('stack:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]'); // one column below 900px
    // On one column the summary follows the lines.
    expect(document.querySelector('[data-group]')!.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('discount codes (I-10)', () => {
  it('applying a code puts the chip in and the response totals in', async () => {
    const after = viewCart([ship('d')], {
      total: usd(1800), codes: [{ id: 'c-1', code: 'WELCOME10', name: 'Welcome', state: 'MatchesCart' }], discount: usd(200),
    });
    const { stub } = setup(viewCart([ship('d')]), { routes: { '/api/cart': (init) => (init?.method === 'PATCH' ? { cart: after } : { cart: viewCart([ship('d')]) }) } });
    await userEvent.type(screen.getByLabelText('Discount code'), ' WELCOME10{Enter}');
    expect(await screen.findByText('WELCOME10')).toBeInTheDocument();
    expect(screen.getByTestId('order-total')).toHaveTextContent('$18.00');
    expect(screen.getByLabelText('Discount code')).toHaveValue('');
    expect(JSON.parse(String(stub.calls.find((c) => c.init?.method === 'PATCH')?.init?.body))).toEqual({ action: 'applyDiscountCode', code: 'WELCOME10' });
  });

  it('Duplicate code says it is already applied and sends nothing', async () => {
    const applied = viewCart([ship('d')], { codes: [{ id: 'c-1', code: 'WELCOME10', name: 'Welcome', state: 'MatchesCart' }] });
    const { stub } = setup(applied);
    await userEvent.type(screen.getByLabelText('Discount code'), 'welcome10{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('That code is already applied');
    expect(stub.calls.some((c) => c.init?.method === 'PATCH')).toBe(false);
  });

  it('Discount code rejected tells why and leaves totals unchanged', async () => {
    const unchanged = viewCart([ship('d')], { total: usd(2815) });
    setup(viewCart([ship('d')], { total: usd(1) }), {
      routes: {
        '/api/cart': (init) =>
          init?.method === 'PATCH'
            ? Response.json({ error: { code: 'code_not_applied', message: 'x', details: { reason: 'NotActive', cart: unchanged } } }, { status: 422 })
            : { cart: viewCart([ship('d')], { total: usd(1) }) },
      },
    });
    await userEvent.type(screen.getByLabelText('Discount code'), 'OLD{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('That code has expired');
    expect(screen.getByTestId('order-total')).toHaveTextContent('$28.15'); // no stale total survives
  });

  it('a code that stops applying stays visible, muted, with the reason, and can be removed', async () => {
    const stale = viewCart([ship('d')], { codes: [{ id: 'c-2', code: 'COFFEE15', state: 'DoesNotMatchCart', reasonKey: 'code.reason.DoesNotMatchCart' }] });
    const { stub } = setup(stale, { routes: { '/api/cart': (init) => (init?.method === 'PATCH' ? { cart: viewCart([ship('d')]) } : { cart: stale }) } });
    expect(screen.getByText('No longer applies to your bag')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove code COFFEE15' }));
    await waitFor(() => expect(screen.queryByText('COFFEE15')).toBeNull());
    expect(JSON.parse(String(stub.calls.find((c) => c.init?.method === 'PATCH')?.init?.body))).toEqual({ action: 'removeDiscountCode', id: 'c-2' });
  });

  it('no axe violations', async () => {
    const { container } = setup(mixed());
    await expectNoAxeViolations(container);
  });

  it('no axe violations for the empty bag', async () => {
    const { container } = setup(viewCart([]));
    await expectNoAxeViolations(container);
  });
});
