// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorePickerContext } from '@/context/StorePickerContext';
import { useCartSummary } from '@/hooks/useCartSummary';
import type { GarageState } from '@/lib/types';
import { installFakeApi, renderVehicle, stateOf } from '@/test/vehicle';
import { PdpBuyBox } from './PdpBuyBox';
import { boxProps, detail, GOLF_2016, GOLF_2022 } from './test-fixtures';

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => router,
  usePathname: () => '/mau-reseller-north/p/vektra-front-brake-pad-set',
}));

const POLICIES = [
  { key: 'mau-rp-monthly', label: 'Monthly' },
  { key: 'mau-rp-quarterly', label: 'Every 3 months' },
  { key: 'mau-rp-half-yearly', label: 'Every 6 months' },
];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

interface Harness {
  posts: Array<Record<string, unknown>>;
  policyCalls: () => number;
}
/** The garage fake plus the cart, summary and policy routes this component talks to. */
function install(garage: GarageState, options: { cartStatus?: number } = {}): Harness {
  installFakeApi(garage);
  const base = globalThis.fetch;
  const posts: Array<Record<string, unknown>> = [];
  let units = 0;
  let policyCalls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      if (input === '/api/cart/lines') {
        if (options.cartStatus && options.cartStatus !== 200) return json({ error: 'x' }, options.cartStatus);
        const body = JSON.parse(String(init?.body)) as { quantity: number };
        posts.push(body);
        units += body.quantity;
        return json({ cartId: 'c1', count: units });
      }
      if (input === '/api/cart/summary') return json({ count: units });
      if (input.startsWith('/api/subscriptions/policies')) {
        policyCalls += 1;
        return json({ policies: POLICIES });
      }
      return base(input, init);
    }),
  );
  return { posts, policyCalls: () => policyCalls };
}

function CartProbe() {
  const { count } = useCartSummary();
  return <output aria-label="cart count">{count}</output>;
}

const ui = (props = boxProps()) => (
  <>
    <CartProbe />
    <PdpBuyBox {...props} />
  </>
);
const render = (props = boxProps(), garage = stateOf(GOLF_2016)) => renderVehicle(ui(props), { garage, locale: 'en-US' });

beforeEach(() => {
  router.refresh.mockReset();
  router.replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const panel = () => screen.getByText(/added to your cart/).closest('[role="status"]') as HTMLElement;

const bundleView = (available: number) => ({
  components: [
    { sku: 'SK-1', qty: 2, name: 'Brake disc', inStore: true },
    { sku: 'SK-2', qty: 1, name: 'Brake pads', inStore: available > 0 },
  ],
  available,
});

describe('Buy box: bundles (W-11)', () => {
  it('lists the components and adds the bundle like a part', async () => {
    const h = install(stateOf(GOLF_2016));
    render(boxProps({ bundle: bundleView(3) }));
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['2 × Brake disc', '1 × Brake pads']);
    expect(screen.getByText('Available as a bundle')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    await waitFor(() => expect(h.posts).toEqual([{ sku: 'MLV-BP-41001', quantity: 1 }]));
  });
  it('with no bundle available it says Currently unavailable and disables Add', () => {
    install(stateOf(GOLF_2016));
    render(boxProps({ bundle: bundleView(0) }));
    expect(screen.getByText('Currently unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
  });
  it('a bundle is never offered as a subscription', async () => {
    install(stateOf(GOLF_2016));
    render(boxProps({ product: detail({ recurringEligible: true }), bundle: bundleView(2) }));
    expect(screen.queryByText('Subscribe and save')).not.toBeInTheDocument();
  });
});

describe('Buy box: quantity and add to cart', () => {
  it('add three posts quantity 3', async () => {
    const h = install(stateOf(GOLF_2016));
    const user = userEvent.setup();
    render();
    const quantity = screen.getByRole('textbox', { name: 'Quantity' });
    await user.clear(quantity);
    await user.type(quantity, '3');
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    await waitFor(() => expect(h.posts).toEqual([{ sku: 'MLV-BP-41001', quantity: 3 }]));
    expect(await screen.findByText('3 added to your cart')).toBeInTheDocument();
  });

  it('panel offers continue shopping and view cart', async () => {
    install(stateOf(GOLF_2016));
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    await screen.findByText('1 added to your cart');
    expect(within(panel()).getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/en-US/mau-reseller-north/cart');
    await user.click(within(panel()).getByRole('button', { name: 'Continue shopping' }));
    expect(screen.queryByText(/added to your cart/)).not.toBeInTheDocument();
  });

  it('cart count in the header updates', async () => {
    install(stateOf(GOLF_2016));
    const user = userEvent.setup();
    render();
    await waitFor(() => expect(screen.getByLabelText('cart count')).toHaveTextContent('0'));
    const quantity = screen.getByRole('textbox', { name: 'Quantity' });
    await user.clear(quantity);
    await user.type(quantity, '2');
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    await waitFor(() => expect(screen.getByLabelText('cart count')).toHaveTextContent('2'));
  });

  it('disabled without a price', () => {
    install(stateOf(GOLF_2016));
    render(boxProps({ product: detail({ price: null }) }));
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
    expect(screen.getByText('Price unavailable')).toBeInTheDocument();
  });

  it('a price error says so with an alert', async () => {
    install(stateOf(GOLF_2016), { cartStatus: 422 });
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This part has no price for you right now.');
  });

  it('another error offers a retry message', async () => {
    install(stateOf(GOLF_2016), { cartStatus: 500 });
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not add this part. Please try again.');
  });

  it('non fitting part can still be added and the status warns', async () => {
    const h = install(stateOf(GOLF_2022));
    const user = userEvent.setup();
    render(boxProps(), stateOf(GOLF_2022));
    const add = screen.getByRole('button', { name: 'Add to cart' });
    expect(add).toBeEnabled();
    await user.click(add);
    await screen.findByText('1 added to your cart');
    expect(h.posts).toHaveLength(1);
    expect(panel()).toHaveTextContent('This part may not fit your 2022 Volkswagen Golf · 2.0 TDI.');
    expect(within(panel()).getByRole('link', { name: 'View fitting alternatives' })).toHaveAttribute('href', '/en-US/mau-reseller-north/category/brakes');
  });

  it('a fitting part adds without the warning', async () => {
    install(stateOf(GOLF_2016));
    const user = userEvent.setup();
    render();
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    await screen.findByText('1 added to your cart');
    expect(panel()).not.toHaveTextContent('may not fit');
  });

  it('quantity survives a vehicle change', async () => {
    const garage = stateOf(GOLF_2016, GOLF_2022);
    install(garage);
    const user = userEvent.setup();
    render(boxProps(), garage);
    const quantity = screen.getByRole('textbox', { name: 'Quantity' });
    await user.clear(quantity);
    await user.type(quantity, '5');
    expect(screen.getByText(/does not fit your 2022/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change vehicle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Your vehicles' });
    await user.click(within(dialog).getByRole('button', { name: /Set 2016 Volkswagen Golf · 2.0 TDI as active/ }));
    await waitFor(() => expect(screen.getByText(/Fits your 2016 Volkswagen Golf/)).toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toBe(quantity);
    expect((quantity as HTMLInputElement).value).toBe('5');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('store change refreshes stock without losing quantity', async () => {
    install(stateOf(GOLF_2016));
    const user = userEvent.setup();
    const view = render();
    expect(screen.getByText('In stock at Küstenwerk Hamburg-Harburg')).toBeInTheDocument();
    const quantity = screen.getByRole('textbox', { name: 'Quantity' });
    await user.clear(quantity);
    await user.type(quantity, '3');
    // The store picker calls router.refresh(); the server then sends new props for the new branch.
    view.rerender(
      ui(
        boxProps({
          product: detail({ stock: { atBranch: false, quantity: 0 }, price: { centAmount: 4990, currencyCode: 'USD', fractionDigits: 2 } }),
          branch: { name: 'Küstenwerk Lübeck', address: { street: 'Holstenstraße 5', postalCode: '23552', city: 'Lübeck' }, pickup: 'ship-to-store' },
        }),
      ),
    );
    expect(screen.getByText('Not in stock at Küstenwerk Lübeck')).toBeInTheDocument();
    expect(screen.getByText('$49.90')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Quantity' })).toBe(quantity);
    expect((quantity as HTMLInputElement).value).toBe('3');
  });
});

describe('Buy box: subscribe and save', () => {
  const eligible = () => boxProps({ product: detail({ recurringEligible: true }) });

  it('subscribe option only for recurring-eligible parts', async () => {
    const h = install(stateOf(GOLF_2016));
    render();
    expect(screen.queryByRole('radio', { name: 'Subscribe and save' })).not.toBeInTheDocument();
    expect(h.policyCalls()).toBe(0);
  });

  it('subscribe option hidden when the flag is off', () => {
    const h = install(stateOf(GOLF_2016));
    render(boxProps({ product: detail({ recurringEligible: true }), subscriptionsEnabled: false }));
    expect(screen.queryByRole('radio', { name: 'Subscribe and save' })).not.toBeInTheDocument();
    expect(h.policyCalls()).toBe(0);
  });

  it('policy list comes from the server route', async () => {
    const h = install(stateOf(GOLF_2016));
    const user = userEvent.setup();
    render(eligible());
    await user.click(await screen.findByRole('radio', { name: 'Subscribe and save' }));
    const select = screen.getByRole('combobox', { name: 'Deliver every' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Monthly', 'Every 3 months', 'Every 6 months']);
    expect(h.policyCalls()).toBeGreaterThan(0);
    expect(screen.getByText('You can skip, pause or cancel any time in your account.')).toBeInTheDocument();
    expect(screen.getByText('Each delivery is charged at the current price: $54.90')).toBeInTheDocument();
  });

  it('subscribing posts the policy key', async () => {
    const h = install(stateOf(GOLF_2016));
    const user = userEvent.setup();
    render(eligible());
    await user.click(await screen.findByRole('radio', { name: 'Subscribe and save' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Deliver every' }), 'mau-rp-quarterly');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    await waitFor(() => expect(h.posts).toEqual([{ sku: 'MLV-BP-41001', quantity: 1, recurrencePolicyKey: 'mau-rp-quarterly' }]));
    expect(await screen.findByText('Subscription added to your cart · Every 3 months')).toBeInTheDocument();
  });

  it('one-time purchase never sends a policy key', async () => {
    const h = install(stateOf(GOLF_2016));
    const user = userEvent.setup();
    render(eligible());
    await screen.findByRole('radio', { name: 'Subscribe and save' });
    await user.click(screen.getByRole('radio', { name: 'One-time purchase' }));
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    await waitFor(() => expect(h.posts).toHaveLength(1));
    expect(h.posts[0]).not.toHaveProperty('recurrencePolicyKey');
  });

  it('switching back to one-time after choosing a frequency sends no key', async () => {
    const h = install(stateOf(GOLF_2016));
    const user = userEvent.setup();
    render(eligible());
    await user.click(await screen.findByRole('radio', { name: 'Subscribe and save' }));
    await user.click(screen.getByRole('radio', { name: 'One-time purchase' }));
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    await waitFor(() => expect(h.posts).toHaveLength(1));
    expect(h.posts[0]).not.toHaveProperty('recurrencePolicyKey');
  });

  it('subscription choice survives a branch change', async () => {
    install(stateOf(GOLF_2016));
    const user = userEvent.setup();
    const view = render(eligible());
    await user.click(await screen.findByRole('radio', { name: 'Subscribe and save' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Deliver every' }), 'mau-rp-half-yearly');
    view.rerender(
      ui(
        boxProps({
          product: detail({ recurringEligible: true, price: { centAmount: 4990, currencyCode: 'USD', fractionDigits: 2 } }),
          branch: { name: 'Küstenwerk Lübeck', address: { street: 'Holstenstraße 5', postalCode: '23552', city: 'Lübeck' }, pickup: 'tomorrow' },
        }),
      ),
    );
    expect(screen.getByRole('radio', { name: 'Subscribe and save' })).toBeChecked();
    expect((screen.getByRole('combobox', { name: 'Deliver every' }) as HTMLSelectElement).value).toBe('mau-rp-half-yearly');
    expect(screen.getByText('Each delivery is charged at the current price: $49.90')).toBeInTheDocument();
  });
});

describe('Buy box: variants, availability and accessibility', () => {
  it('a product with several variants offers an Option select that writes ?sku=', async () => {
    install(stateOf(GOLF_2016));
    const user = userEvent.setup();
    render(boxProps({ product: detail({ variants: [{ sku: 'MLV-BP-41001' }, { sku: 'MLV-BP-41002' }] }) }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Option' }), 'MLV-BP-41002');
    expect(router.replace).toHaveBeenCalledWith('/mau-reseller-north/p/vektra-front-brake-pad-set?sku=MLV-BP-41002');
  });

  it('change store opens the picker', async () => {
    install(stateOf(GOLF_2016));
    const open = vi.fn();
    const user = userEvent.setup();
    renderVehicle(
      <StorePickerContext.Provider value={{ open, isOpen: false }}>
        <PdpBuyBox {...boxProps()} />
      </StorePickerContext.Provider>,
      { garage: stateOf(GOLF_2016), locale: 'en-US' },
    );
    await user.click(screen.getByRole('button', { name: 'Change store' }));
    expect(open).toHaveBeenCalled();
  });

  it('seller line uses the reseller name and days', () => {
    install(stateOf(GOLF_2016));
    render(boxProps({ returnDays: 14 }));
    expect(screen.getByText('Sold and fulfilled by Küstenwerk Autoteile. 14-day returns at any counter.')).toBeInTheDocument();
  });

  it('no axe violations', async () => {
    install(stateOf(GOLF_2016));
    const { container } = render(boxProps({ product: detail({ recurringEligible: true }) }));
    await screen.findByRole('radio', { name: 'Subscribe and save' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
