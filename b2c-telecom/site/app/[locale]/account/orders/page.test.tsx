import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { mapOrder } from '@/lib/mappers/order';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { orderA, orderB, ctOrder, ctLine } from '@/test/fixtures/orders';
import { renderWithProviders } from '@/test/utils';
import type { Order } from '@/lib/types';

const state = vi.hoisted(() => ({ session: {} as { customerId?: string }, getCustomer: vi.fn(), list: vi.fn(), push: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (arg: { locale: string; namespace: string }) => createTranslator({ locale: arg.locale, messages: arg.locale === 'de-DE' ? deMessages : enMessages, namespace: arg.namespace as never }),
}));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  redirect: ({ href, locale }: { href: string; locale: string }) => {
    throw new Error(`REDIRECT /${locale}${href}`);
  },
  useRouter: () => ({ push: state.push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/ct/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/ct/customer', () => ({ getCustomerById: state.getCustomer, sessionsValidAfterOf: () => undefined }));
vi.mock('@/lib/ct/orders', () => ({ getCustomerOrders: state.list }));

import OrdersPage from './page';

const map = (...orders: Parameters<typeof mapOrder>[0][]): Order[] => orders.map((order) => mapOrder(order, 'en-US'));

async function renderPage(query: Record<string, string> = {}, locale: 'en-US' | 'de-DE' = 'en-US') {
  const ui = await OrdersPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) });
  return renderWithProviders(ui, { locale });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.session = { customerId: 'cust-alex' };
  state.getCustomer.mockResolvedValue({ id: 'cust-alex', email: 'a@b.c', firstName: 'Alex', addresses: [] });
  state.list.mockResolvedValue({ orders: map(orderA(), orderB()), total: 2 });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('order list page', () => {
  it('Own orders only: only the session customer\'s orders are queried and paginated across the whole history', async () => {
    state.list.mockResolvedValue({ orders: map(orderA(), orderB()), total: 12 });
    await renderPage({ page: '2' });
    expect(state.list).toHaveBeenCalledTimes(1);
    expect(state.list).toHaveBeenCalledWith('cust-alex', 'en-US', { status: 'all', page: 2 });
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/en-US/account/orders');
    expect(screen.getByText('Next')).toHaveAttribute('aria-disabled', 'true');
  });

  it('sends anonymous visitors to login before reading any order', async () => {
    state.session = {};
    await expect(OrdersPage({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT /en-US/login?returnTo=%2Fen-US%2Faccount%2Forders');
    expect(state.list).not.toHaveBeenCalled();
  });

  it('lists number, date, items, status and the total with the monthly amount', async () => {
    await renderPage();
    const row = within(screen.getByRole('row', { name: /QA-AAAA01/ }));
    expect(row.getByRole('link', { name: 'QA-AAAA01' })).toHaveAttribute('href', '/en-US/account/orders/QA-AAAA01');
    expect(row.getByText('Mar 7, 2026')).toBeInTheDocument();
    expect(row.getByText('Cable 500, Apple TV+')).toBeInTheDocument();
    expect(row.getByText('Placed')).toBeInTheDocument();
    expect(row.getByText('$69.98 today · $69.98/mo')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument();
  });

  it('summarises more than two lines as "A, B +n"', async () => {
    const many = ctOrder({ orderNumber: 'QA-MANY', total: 300, lines: ['One', 'Two', 'Three'].map((name, i) => ctLine({ id: `l${i}`, productKey: 'malva-offer-spotify', sku: 'MLV-ADD-SPOTIFY-MTH', name, total: 100 })) });
    state.list.mockResolvedValue({ orders: map(many), total: 1 });
    await renderPage();
    expect(screen.getByText('One, Two +1')).toBeInTheDocument();
  });

  it.each([
    ['open', 'open'],
    ['completed', 'completed'],
    ['cancelled', 'cancelled'],
    ['nonsense', 'all'],
    ['', 'all'],
  ])('?status=%s queries the %s filter', async (value, expected) => {
    await renderPage(value === '' ? {} : { status: value });
    expect(state.list).toHaveBeenCalledWith('cust-alex', 'en-US', { status: expected, page: 1 });
  });

  it.each([['abc'], ['0'], ['-3'], ['1.5']])('an invalid page (%s) reads as page 1', async (value) => {
    await renderPage({ page: value });
    expect(state.list).toHaveBeenCalledWith('cust-alex', 'en-US', { status: 'all', page: 1 });
  });

  it('a page beyond the end falls back to page 1', async () => {
    state.list.mockResolvedValueOnce({ orders: [], total: 12 }).mockResolvedValueOnce({ orders: map(orderA()), total: 12 });
    await renderPage({ page: '99' });
    expect(state.list).toHaveBeenNthCalledWith(1, 'cust-alex', 'en-US', { status: 'all', page: 99 });
    expect(state.list).toHaveBeenNthCalledWith(2, 'cust-alex', 'en-US', { status: 'all', page: 1 });
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('marks the selected filter chip and keeps the filter in the pagination links', async () => {
    state.list.mockResolvedValue({ orders: map(orderA()), total: 25 });
    await renderPage({ status: 'open' });
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en-US/account/orders?status=open&page=2');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('shows the empty state with a way to browse plans', async () => {
    state.list.mockResolvedValue({ orders: [], total: 0 });
    await renderPage();
    expect(screen.getByText('No orders yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse plans' })).toBeInTheDocument();
  });

  it('shows the empty filter state with a link back to all orders', async () => {
    state.list.mockResolvedValue({ orders: [], total: 0 });
    await renderPage({ status: 'cancelled' });
    expect(screen.getByText('No orders match this filter.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Show all' })).toHaveAttribute('href', '/en-US/account/orders');
  });

  it('reports an unavailable list instead of failing the page', async () => {
    state.list.mockRejectedValue(new Error('boom'));
    await renderPage();
    expect(screen.getByText('This section is unavailable right now. Try again in a moment.')).toBeInTheDocument();
  });

  it('speaks German', async () => {
    await renderPage({}, 'de-DE');
    expect(screen.getByRole('heading', { level: 1, name: 'Ihre Bestellungen' })).toBeInTheDocument();
    expect(screen.getAllByText('Aufgegeben')).toHaveLength(2);
  });
});
