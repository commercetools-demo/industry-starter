// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Workstream Y: page-level axe for the cart (empty, with items, subscription line, promo applied and rejected, misfit warning, stock
// notices), the checkout page (loading, widget error, pickup panel, cancelled) and the order confirmation (pickup, shipping, guest, owner).
// The hosted Checkout widget itself is third-party: only our chrome around it is checked.
import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CartPage } from '@/components/cart/CartPage';
import { CheckoutPage } from '@/components/checkout/CheckoutPage';
import { OrderConfirmation } from '@/components/order/OrderConfirmation';
import type { OrderView } from '@/lib/types';
import { cart, eur, line, ship } from '@/test/cart-view-model';
import { GOLF_2016 } from '@/components/product/detail/test-fixtures';
import { stateOf } from '@/test/vehicle';
import { axePage, LOCALES, renderStorePage, stubShellFetch } from '@/test/a11y';

const sdk = vi.hoisted(() => ({ checkoutFlow: vi.fn(), close: vi.fn() }));
vi.mock('@commercetools/checkout-browser-sdk', () => sdk);
vi.mock('@/i18n/routing', async () => ({
  ...(await import('@/test/routing-mock')).mockRouting(),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

afterEach(() => vi.unstubAllGlobals());
const STORE = 'mau-reseller-north';
const session = { sessionId: 'sess-1', projectKey: 'test-project', region: 'europe-west1.gcp' };

describe.each(LOCALES)('a11y: cart page (%s)', (locale) => {
  const page = () => <CartPage store={STORE} />;
  it.each(['default', 'themed'] as const)('with items, %s theme', async (theme) => {
    stubShellFetch();
    renderStorePage(page(), { locale, theme, cart: cart() });
    expect(await axePage()).toHaveNoViolations();
  });

  it('empty cart', async () => {
    stubShellFetch();
    renderStorePage(page(), { locale, cart: null });
    expect(await axePage()).toHaveNoViolations();
  });

  it('subscription line, applied promo code and a rejected one', async () => {
    stubShellFetch();
    renderStorePage(page(), {
      locale,
      cart: cart({
        hasSubscription: true,
        lines: [line({ recurrence: { policyKey: 'mau-rp-monthly', policyName: 'Monatlich', priceMode: 'Dynamic' } })],
        promoCodes: [{ code: 'WELCOME5', id: 'c1', state: 'applied', reason: null }, { code: 'OLD', id: 'c2', state: 'not-applied', reason: 'not-valid' }],
      }),
    });
    expect(await axePage()).toHaveNoViolations();
  });

  it('a part that does not fit the vehicle, a capped quantity and an out-of-stock line', async () => {
    stubShellFetch();
    renderStorePage(page(), {
      locale,
      cart: cart({
        lines: [
          line({ fitment: { fitmentKeys: ['Audi|A4|2008|2012|1.8 TFSI'], universalFit: false } }),
          line({ id: 'li-3', sku: 'X-3', name: 'Out of stock part', quantity: 1, unitPrice: eur(1000), listUnitPrice: null, total: eur(1000), stock: { fromStore: 0, shipsLater: 0, capped: false, available: 0, branchName: 'Malva Berlin' } }),
          line({ id: 'li-4', sku: 'X-4', name: 'Capped part', quantity: 2, stock: { fromStore: 2, shipsLater: 0, capped: true, available: 2, branchName: 'Malva Berlin' } }),
        ],
        delivery: { selected: 'ship', options: [ship] },
      }),
      fallback: { '/api/garage': stateOf(GOLF_2016) },
    });
    expect(await axePage()).toHaveNoViolations();
  });
});

describe.each(LOCALES)('a11y: checkout page (%s)', (locale) => {
  const page = (over: Partial<Parameters<typeof CheckoutPage>[0]> = {}) => <CheckoutPage store={STORE} pickup={null} cancelled={false} devComplete={false} {...over} />;
  const mountSession = (ok = true) =>
    stubShellFetch({ '/api/checkout/session': ok ? session : { error: 'x' } });

  it.each(['default', 'themed'] as const)('widget mounted, %s theme', async (theme) => {
    mountSession();
    renderStorePage(page(), { locale, theme });
    await waitFor(() => expect(sdk.checkoutFlow).toHaveBeenCalled());
    expect(await axePage()).toHaveNoViolations();
  });

  it('pickup facts, cancelled notice and the dev helper', async () => {
    mountSession();
    renderStorePage(
      page({ cancelled: true, devComplete: true, pickup: { branchName: 'Malva Berlin', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' }, hours: { mon: ['08:00', '18:00'], sat: ['09:00', '13:00'] } } }),
      { locale },
    );
    expect(await axePage()).toHaveNoViolations();
  });

  it('a session that could not be created (error state with retry)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'no' }), { status: 500 })));
    renderStorePage(page(), { locale });
    await waitFor(() => expect(document.querySelector('[role="alert"]')).not.toBeNull());
    expect(await axePage()).toHaveNoViolations();
  });
});

const money = (centAmount: number) => ({ centAmount, currencyCode: 'EUR', fractionDigits: 2 });
const order: OrderView = {
  id: 'o-1',
  number: 'MA-7K3M9Q2X',
  storeKey: STORE,
  status: 'placed',
  mode: 'pickup',
  payment: 'paid',
  shippingMethodKey: 'mau-ship-pickup',
  email: 'qa-p1@example.com',
  hasCustomer: false,
  lines: [
    { id: 'l1', brand: 'Brembo', name: 'Front brake disc', imageUrl: 'https://img.example.test/a.jpg', quantity: 2, total: money(10000), recurrence: null },
    { id: 'l2', brand: null, name: 'Oil filter', imageUrl: null, quantity: 1, total: money(1500), recurrence: { policyName: 'Every 3 months' } },
  ],
  totals: { subtotal: money(12000), savings: [{ discountId: 'd1', name: 'Spring sale', amount: money(500) }], delivery: money(0), tax: { label: 'Sales tax (19%)', rate: 0.19, amount: money(1840) }, total: money(11500), pricesIncludeTax: true },
  pickup: { branchName: 'Malva Berlin', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' }, hours: { mon: ['08:00', '18:00'], sat: ['09:00', '13:00'] }, timezone: 'Europe/Berlin' },
  shipTo: null,
  shipWindow: { min: 2, max: 3 },
  storeName: 'Malva North',
  subscription: { frequencies: ['Every 3 months'], state: 'scheduled', nextOrderAt: '2026-12-15T08:00:00.000Z' },
  timezone: 'Europe/Berlin',
};

describe.each(LOCALES)('a11y: order confirmation (%s)', (locale) => {
  const confirmation = (view: OrderView, viewer: 'guest' | 'owner') => <OrderConfirmation view={view} store={STORE} viewer={viewer} privatePath={`/${locale}/${STORE}/checkout/confirmation/MA-7K3M9Q2X?t=tok.en.sig`} token="tok.en.sig" />;

  it.each(['default', 'themed'] as const)('pickup order for a guest, %s theme', async (theme) => {
    stubShellFetch();
    renderStorePage(confirmation(order, 'guest'), { locale, theme });
    expect(await axePage()).toHaveNoViolations();
  });

  it('shipped order for the signed-in owner with a failed payment', async () => {
    stubShellFetch();
    const ship: OrderView = { ...order, mode: 'ship', pickup: null, payment: 'failed', status: 'shipped', hasCustomer: true, shipTo: { name: 'Ada Test', street: 'Lindenallee 4', postalCode: '20095', city: 'Hamburg', country: 'DE' }, subscription: null };
    renderStorePage(confirmation(ship, 'owner'), { locale, signedIn: true });
    expect(await axePage()).toHaveNoViolations();
  });
});
