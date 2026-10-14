// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Workstream Y: page-level axe for the account area (overview, orders, order detail, return form, garage, addresses, payment methods,
// subscriptions, returns, profile) and the auth pages (sign-in, register, forgot and reset password) inside the store shell.
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountShell } from '@/components/account/AccountShell';
import { AddressBook } from '@/components/account/AddressBook';
import { ForgotPasswordForm, RegisterForm, ResetPasswordForm } from '@/components/account/AuthForms';
import { DeleteAccountPanel } from '@/components/account/DeleteAccountPanel';
import { GaragePanel } from '@/components/account/GaragePanel';
import { OrderDetail } from '@/components/account/OrderDetail';
import { OrderList } from '@/components/account/OrderList';
import { OverviewPanel } from '@/components/account/OverviewPanel';
import { PageTitle } from '@/components/account/Panel';
import { PasswordForm } from '@/components/account/PasswordForm';
import { PaymentMethodsPanel } from '@/components/account/PaymentMethodsPanel';
import { ProfileForm } from '@/components/account/ProfileForm';
import { ReturnForm } from '@/components/account/ReturnForm';
import { ReturnList } from '@/components/account/ReturnList';
import { SubscriptionList } from '@/components/account/SubscriptionList';
import { SignInForm } from '@/components/auth/SignInForm';
import type { OrderView, ReturnView } from '@/lib/types';
import { axePage, LOCALES, renderStorePage, stubShellFetch, type Locale } from '@/test/a11y';

vi.mock('@/i18n/routing', async () => ({
  ...(await import('@/test/routing-mock')).mockRouting(),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

afterEach(() => vi.unstubAllGlobals());
const STORE = 'mau-reseller-north';
const eur = (centAmount: number) => ({ centAmount, currencyCode: 'EUR', fractionDigits: 2 });

const entry = (id: string, model: string, nickname?: string) => ({ id, make: 'Volkswagen', model, year: 2016, engine: '2.0 TDI', fitmentKey: 'k', ...(nickname ? { nickname } : {}) });
const garage = (() => {
  const entries = [entry('a', 'Golf', 'Daily'), entry('b', 'Polo')];
  const vehicles = entries.map((e) => ({ id: e.id, make: e.make, model: e.model, year: e.year, engine: e.engine, label: `${e.year} ${e.make} ${e.model} · ${e.engine}` }));
  return { garage: { vehicles: entries, activeId: 'a' }, vehicles, active: vehicles[0] };
})();
const address = (id: string, city: string, isDefault = false) => ({ id, firstName: 'Anna', lastName: 'Schneider', streetName: 'Hauptstr.', streetNumber: '1', postalCode: '10115', city, country: 'DE', phone: null, isDefault });
const api = {
  '/api/auth/me': { customer: { id: 'c1', email: 'anna@example.com', firstName: 'Anna', lastName: 'Schneider' } },
  '/api/garage': garage,
  '/api/account/addresses': { addresses: [address('a1', 'Berlin', true), address('a2', 'Hamburg')], defaultShippingAddressId: 'a1', countries: ['DE', 'AT'] },
  '/api/account/payment-methods': { methods: [{ id: 'pm1', label: 'Visa', last4: '4242', expiry: '04/29', isDefault: true }], hasSubscriptions: true },
  '/api/account/profile': { profile: { email: 'anna@example.com', firstName: 'Anna', lastName: 'Schneider', mobile: '+49 170 1', marketingConsent: false } },
  '/api/account/subscriptions': {
    offered: true,
    subscriptions: [
      { id: 'ro1', status: 'active', frequency: 'Every 3 months', policyKey: 'mau-rp-quarterly', nextOrderAt: '2026-11-01T00:00:00Z', skipPending: 0, orderNumber: 'MA-ABCD2345', lines: [{ name: 'Oil filter', quantity: 2, imageUrl: null }] },
      { id: 'ro2', status: 'failed', frequency: 'Every month', policyKey: 'mau-rp-monthly', nextOrderAt: null, skipPending: 0, orderNumber: 'MA-ZZZZ9999', lines: [{ name: 'Wiper blades', quantity: 1, imageUrl: null }] },
    ],
    policies: [{ key: 'mau-rp-monthly', label: 'Every month' }, { key: 'mau-rp-quarterly', label: 'Every 3 months' }],
  },
};

const order: OrderView = {
  id: 'o1',
  number: 'MA-ABCD2345',
  storeKey: STORE,
  status: 'delivered',
  mode: 'pickup',
  payment: 'paid',
  shippingMethodKey: 'mau-ship-pickup',
  email: 'anna@example.com',
  hasCustomer: true,
  lines: [{ id: 'l1', brand: 'Brembo', name: 'Brake pads', imageUrl: null, quantity: 2, total: eur(8000), recurrence: null }],
  totals: { subtotal: eur(8000), savings: [], delivery: eur(0), tax: { label: 'VAT (19%)', rate: 0.19, amount: eur(1277) }, total: eur(8000), pricesIncludeTax: true },
  pickup: { branchName: 'North Branch', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' }, hours: { mon: ['08:00', '18:00'] }, timezone: 'Europe/Berlin' },
  shipTo: null,
  shipWindow: null,
  storeName: 'Malva North',
  subscription: null,
  timezone: 'Europe/Berlin',
};
const returns: ReturnView[] = [
  { returnNumber: 'RT-1', tracking: 'T-1', orderNumber: 'MA-ABCD2345', requestedAt: '2026-10-05T10:00:00Z', status: 'requested', reason: 'Wrong part', items: [{ lineItemId: 'l1', name: 'Brake pads', quantity: 1 }] },
  { returnNumber: 'RT-2', tracking: 'T-2', orderNumber: 'MA-ABCD2345', requestedAt: '2026-10-06T10:00:00Z', status: 'rejected', reason: null, items: [{ lineItemId: 'l1', name: 'Brake pads', quantity: 1 }] },
];

type Panel = [string, () => ReactNode];
const PANELS: Panel[] = [
  ['overview', () => <OverviewPanel store={STORE} firstName="Anna" latest={{ number: 'MA-ABCD2345', createdAt: '2026-10-01T10:00:00Z', status: 'ready-for-pickup' }} ready={[{ orderNumber: 'MA-ABCD2345', storeName: 'North Branch', address: { street: 'Hauptstr. 1', postalCode: '10115', city: 'Berlin' }, hours: { mon: ['08:00', '18:00'] } }]} timeZone="Europe/Berlin" />],
  ['orders', () => <div className="grid gap-5"><PageTitle>Orders</PageTitle><OrderList store={STORE} list={{ items: [{ number: 'MA-AAAA1111', createdAt: '2026-10-01T10:00:00Z', status: 'delivered', total: eur(11900), itemCount: 3 }, { number: 'MA-BBBB2222', createdAt: '2026-09-01T10:00:00Z', status: 'cancelled', total: eur(500), itemCount: 1 }], page: 2, pageSize: 10, total: 25 }} timeZone="Europe/Berlin" /></div>],
  ['orders (empty)', () => <OrderList store={STORE} list={{ items: [], page: 1, pageSize: 10, total: 0 }} />],
  ['order detail', () => <OrderDetail view={order} store={STORE} createdAt="2026-10-01T10:00:00Z" eligibility={{ eligible: true, problem: null, deadline: '2026-11-10T00:00:00Z', lines: [{ lineItemId: 'l1', name: 'Brake pads', remaining: 2 }] }} returns={returns} />],
  ['return form', () => <ReturnForm store={STORE} orderNumber="MA-ABCD2345" lines={[{ lineItemId: 'l1', name: 'Brake pads', remaining: 2 }]} deadline="2026-11-10T00:00:00Z" timeZone="Europe/Berlin" />],
  ['returns', () => <ReturnList store={STORE} returns={returns} timeZone="Europe/Berlin" />],
  ['garage', () => <GaragePanel />],
  ['addresses', () => <AddressBook />],
  ['payment methods', () => <PaymentMethodsPanel />],
  ['subscriptions', () => <SubscriptionList store={STORE} timeZone="Europe/Berlin" />],
  ['profile', () => <><ProfileForm /><PasswordForm /><DeleteAccountPanel store={STORE} /></>],
];

async function inShell(body: ReactNode, locale: Locale, theme: 'default' | 'themed' = 'default') {
  stubShellFetch(api);
  renderStorePage(<AccountShell store={STORE} showSubscriptions>{body}</AccountShell>, { locale, theme, signedIn: true });
  // The client panels read their data through SWR: wait for the first non-loading content.
  await screen.findAllByRole('main');
  await new Promise((resolve) => setTimeout(resolve, 30));
}

describe.each(LOCALES)('a11y: account area (%s)', (locale) => {
  it.each(PANELS)('%s page', async (_name, panel) => {
    await inShell(panel(), locale);
    expect(await axePage()).toHaveNoViolations();
  });

  it('overview with the themed store', async () => {
    await inShell(PANELS[0][1](), locale, 'themed');
    expect(await axePage()).toHaveNoViolations();
  });
});

describe.each(LOCALES)('a11y: auth pages (%s)', (locale) => {
  const card = (children: ReactNode) => (
    <div className="mx-auto grid max-w-content gap-5 p-4">
      <div className="mx-auto grid w-full max-w-prose gap-5 rounded-md border border-border bg-surface p-5">{children}</div>
    </div>
  );
  const forms: Array<[string, () => ReactNode]> = [
    ['sign-in', () => <><h1>Sign in</h1><SignInForm store={STORE} storeName="Küstenwerk" next="/account" /></>],
    ['register', () => <RegisterForm store={STORE} storeName="Küstenwerk" next="/account" />],
    ['forgot password', () => <ForgotPasswordForm store={STORE} />],
    ['reset password', () => <ResetPasswordForm store={STORE} token="abc" />],
    ['reset password without a token', () => <ResetPasswordForm store={STORE} token={null} />],
  ];
  it.each(forms)('%s', async (_name, form) => {
    stubShellFetch(api);
    renderStorePage(card(form()), { locale });
    expect(await axePage()).toHaveNoViolations();
  });
});
