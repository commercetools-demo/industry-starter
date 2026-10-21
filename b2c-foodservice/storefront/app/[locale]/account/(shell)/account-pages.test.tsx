// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  frame: vi.fn(),
  figures: vi.fn(),
  order: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock('next-intl/server', () => ({ setRequestLocale: () => undefined, getTranslations: async () => (k: string) => k }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    h.notFound();
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/i18n/routing', () => ({
  redirect: (a: unknown) => {
    h.redirect(a);
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('@/lib/auth/require-customer', () => ({
  requireCustomerPage: async (path: string) => {
    h.guard(path);
    if (h.guard.mock.calls.length && (globalThis as { __guest?: boolean }).__guest) throw new Error('NEXT_REDIRECT');
    return { customerId: 'c1' };
  },
}));
vi.mock('@/lib/auth/account-frame', () => ({ getAccountFrame: h.frame }));
vi.mock('@/lib/account/collection-data', () => ({ loadCollectionFigures: h.figures }));
vi.mock('@/lib/account/load-order', () => ({ loadAccountOrder: h.order }));
// The client components are not rendered here: only what each page asks for is checked.
vi.mock('@/components/account/AccountShell', () => ({ default: () => null }));
vi.mock('@/components/account/orders/OrdersTab', () => ({ default: () => null }));
vi.mock('@/components/account/orders/OrderDetail', () => ({ default: () => null }));
vi.mock('@/components/account/CollectionTab', () => ({ default: () => null }));
vi.mock('@/components/account/AddressesTab', () => ({ default: () => null }));
vi.mock('@/components/account/PaymentMethodsTab', () => ({ default: () => null }));
vi.mock('@/components/account/SavedTab', () => ({ default: () => null }));
vi.mock('@/components/account/ProfileForm', () => ({ default: () => null }));
vi.mock('@/components/account/PasswordForm', () => ({ default: () => null }));
vi.mock('@/components/account/SettingsTab', () => ({ default: () => null }));
vi.mock('@/components/reviews/MyReviews', () => ({ default: () => null }));

import AddressesPage from '@/app/[locale]/account/(shell)/addresses/page';
import CollectionPage from '@/app/[locale]/account/(shell)/collection/page';
import AccountShellLayout from '@/app/[locale]/account/(shell)/layout';
import IndexPage from '@/app/[locale]/account/(shell)/page';
import OrderPage from '@/app/[locale]/account/(shell)/orders/[orderNumber]/page';
import OrdersPage from '@/app/[locale]/account/(shell)/orders/page';
import PaymentsPage from '@/app/[locale]/account/(shell)/payment-methods/page';
import ProfilePage from '@/app/[locale]/account/(shell)/profile/page';
import ReviewsPage from '@/app/[locale]/account/(shell)/reviews/page';
import SavedPage from '@/app/[locale]/account/(shell)/saved/page';
import SettingsPage from '@/app/[locale]/account/(shell)/settings/page';
import SubscriptionsPage from '@/app/[locale]/account/(shell)/subscriptions/page';

const params = { params: Promise.resolve({ locale: 'en-US' }) };
const guest = (on: boolean) => ((globalThis as { __guest?: boolean }).__guest = on);

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  guest(false);
  h.frame.mockResolvedValue({ customerId: 'c1', firstName: 'Maya' });
  h.figures.mockResolvedValue({ collection: true, freeShippingThreshold: { centAmount: 7500, currencyCode: 'USD' } });
  h.order.mockResolvedValue({ orderNumber: 'MC-1001' });
});

const PAGES: [string, (p: typeof params) => Promise<unknown>, string][] = [
  ['orders', OrdersPage, '/account/orders'],
  ['collection', CollectionPage, '/account/collection'],
  ['subscriptions', SubscriptionsPage, '/account/subscriptions'],
  ['saved', SavedPage, '/account/saved'],
  ['addresses', AddressesPage, '/account/addresses'],
  ['payment methods', PaymentsPage, '/account/payment-methods'],
  ['reviews', ReviewsPage, '/account/reviews'],
  ['profile', ProfilePage, '/account/profile'],
  ['settings', SettingsPage, '/account/settings'],
];

describe('Not signed in', () => {
  it.each(PAGES)('the %s page sends a guest to sign-in with its own path kept', async (_name, Page, path) => {
    guest(true);
    await expect(Page(params)).rejects.toThrow('NEXT_REDIRECT');
    expect(h.guard).toHaveBeenCalledWith(path);
  });

  it('the order page keeps the order number in the destination and reads nothing for a guest', async () => {
    guest(true);
    await expect(OrderPage({ params: Promise.resolve({ locale: 'en-US', orderNumber: 'MC-1001' }) })).rejects.toThrow('NEXT_REDIRECT');
    expect(h.guard).toHaveBeenCalledWith('/account/orders/MC-1001');
    expect(h.order).not.toHaveBeenCalled();
  });

  it('/account itself goes to the Orders tab after the guard', async () => {
    await expect(IndexPage(params)).rejects.toThrow('NEXT_REDIRECT');
    expect(h.guard).toHaveBeenCalledWith('/account/orders');
    expect(h.redirect).toHaveBeenCalledWith({ href: '/account/orders', locale: 'en-US' });
  });

  it('the frame shows nothing for a guest: the children are returned bare, with no account data', async () => {
    h.frame.mockResolvedValue(null);
    const out = (await AccountShellLayout({ children: 'CHILD', params: params.params })) as { type: unknown; props: { children: unknown } };
    expect(out.props.children).toBe('CHILD');
  });

  it('a signed-in customer gets the shell with the first name and the market collection flag', async () => {
    const out = (await AccountShellLayout({ children: 'CHILD', params: Promise.resolve({ locale: 'en-CA' }) })) as { props: { firstName: string; collection: boolean } };
    expect(out.props).toMatchObject({ firstName: 'Maya', collection: false });
    const us = (await AccountShellLayout({ children: 'CHILD', params: params.params })) as { props: { collection: boolean } };
    expect(us.props.collection).toBe(true);
  });
});

describe('Order page', () => {
  const orderParams = (n: string) => ({ params: Promise.resolve({ locale: 'en-US', orderNumber: n }) });

  it('Detail of an order not theirs: unknown and foreign both end in notFound (HTTP 404)', async () => {
    h.order.mockResolvedValue(null);
    await expect(OrderPage(orderParams('MC-2002'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(h.order).toHaveBeenCalledWith('c1', 'MC-2002', 'en-US');
  });

  it('renders the order read on the server for the owner', async () => {
    const out = (await OrderPage(orderParams('MC-1001'))) as { props: { orderNumber: string; initial: unknown } };
    expect(out.props).toMatchObject({ orderNumber: 'MC-1001', initial: { orderNumber: 'MC-1001' } });
  });
});

describe('Collection page', () => {
  it('Collection tab and nav entry are hidden in the Canada market: the page is a 404 there', async () => {
    h.figures.mockResolvedValue({ collection: false, freeShippingThreshold: null });
    await expect(CollectionPage(params)).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('passes the promise-figure threshold to the tab in the US', async () => {
    const out = (await CollectionPage(params)) as { props: { freeShippingThreshold: unknown } };
    expect(out.props.freeShippingThreshold).toEqual({ centAmount: 7500, currencyCode: 'USD' });
  });
});
