import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { mapOrder } from '@/lib/mappers/order';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { orderA, orderB } from '@/test/fixtures/orders';
import { resolveElement } from '@/test/resolveAsync';
import { renderWithProviders } from '@/test/utils';
import type { Order, RecurringSummary } from '@/lib/types';

const state = vi.hoisted(() => ({
  session: {} as { customerId?: string },
  customer: null as unknown,
  orders: vi.fn(),
  recurring: vi.fn(),
  getCustomer: vi.fn(),
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (arg: { locale: string; namespace: string }) => createTranslator({ locale: arg.locale, messages: arg.locale === 'de-DE' ? deMessages : enMessages, namespace: arg.namespace as never }),
}));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  redirect: ({ href, locale }: { href: string; locale: string }) => {
    throw new Error(`REDIRECT /${locale}${href}`);
  },
  usePathname: () => '/account',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/ct/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/ct/customer', () => ({ getCustomerById: state.getCustomer, sessionsValidAfterOf: () => undefined }));
vi.mock('@/lib/ct/orders', () => ({ getCustomerOrdersCached: state.orders, getRecurringSummariesCached: state.recurring }));

import AccountPage from './page';

const address = { id: 'addr-1', firstName: 'Alex', lastName: 'Rivera', streetNumber: '1', streetName: 'Main St', postalCode: '10001', city: 'New York', state: 'NY', country: 'US' };
const customer = (overrides: Record<string, unknown> = {}) => ({ id: 'cust-alex', email: 'alex@example.com', firstName: 'Alex', lastName: 'Rivera', addresses: [address], defaultShippingAddressId: 'addr-1', ...overrides });
const mapped = (...orders: Parameters<typeof mapOrder>[0][]): Order[] => orders.map((order) => mapOrder(order, 'en-US'));
const active = (id: string, nextOrderAt: string): RecurringSummary => ({ id: `r-${id}`, originOrderId: id, state: 'Active', nextOrderAt });

async function renderPage(locale: 'en-US' | 'de-DE' = 'en-US') {
  const ui = await resolveElement(await AccountPage({ params: Promise.resolve({ locale }) }));
  return renderWithProviders(ui, { locale });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.session = { customerId: 'cust-alex' };
  state.getCustomer.mockResolvedValue(customer());
  state.orders.mockResolvedValue([]);
  state.recurring.mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.useRealTimers());

describe('account dashboard', () => {
  it('Session no longer valid: no account data is read and the buyer is sent to login with the dashboard as destination', async () => {
    state.session = {};
    await expect(AccountPage({ params: Promise.resolve({ locale: 'en-US' }) })).rejects.toThrow('REDIRECT /en-US/login?returnTo=%2Fen-US%2Faccount');
    expect(state.getCustomer).not.toHaveBeenCalled();
    expect(state.orders).not.toHaveBeenCalled();
    expect(state.recurring).not.toHaveBeenCalled();
  });

  it('a customer that no longer exists is sent to login too', async () => {
    state.getCustomer.mockResolvedValue(null);
    await expect(AccountPage({ params: Promise.resolve({ locale: 'de-DE' }) })).rejects.toThrow('REDIRECT /de-DE/login?returnTo=%2Fde-DE%2Faccount');
    expect(state.orders).not.toHaveBeenCalled();
  });

  it('Nothing yet on the account: every summary renders its explicit empty state and none is hidden', async () => {
    state.getCustomer.mockResolvedValue(customer({ addresses: [], defaultShippingAddressId: undefined }));
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Hi, Alex' })).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('No upcoming bills.')).toBeInTheDocument();
    expect(screen.getByText('No orders yet.')).toBeInTheDocument();
    expect(screen.getByText('You have no active services yet.')).toBeInTheDocument();
    expect(screen.getByText('Your plan labels appear here once you have an active plan.')).toBeInTheDocument();
    expect(screen.getByText('No address saved yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add an address' })).toHaveAttribute('href', '/en-US/account/addresses');
    expect(screen.getAllByRole('link', { name: 'Browse plans' })).toHaveLength(3);
    expect(screen.queryByText('This section is unavailable right now. Try again in a moment.')).not.toBeInTheDocument();
  });

  it('One backing service down: that panel reports unavailable and every other panel still renders', async () => {
    state.orders.mockRejectedValue(new Error('boom'));
    await renderPage();
    expect(screen.getAllByText('This section is unavailable right now. Try again in a moment.')).toHaveLength(4);
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('1 Main St')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent orders' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Current contract' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Want to change something?' })).toBeInTheDocument();
  });

  it('a panel that does not answer within 4 seconds reports unavailable instead of blocking the page', async () => {
    vi.useFakeTimers();
    state.orders.mockReturnValue(new Promise(() => undefined));
    const pending = resolveElement(await AccountPage({ params: Promise.resolve({ locale: 'en-US' }) }));
    await vi.advanceTimersByTimeAsync(4000);
    renderWithProviders(await pending);
    expect(screen.getAllByText('This section is unavailable right now. Try again in a moment.')).toHaveLength(4);
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
  });

  it('a failed recurring-orders read keeps the amount and says the next bill date is unavailable', async () => {
    state.orders.mockResolvedValue(mapped(orderB()));
    state.recurring.mockRejectedValue(new Error('403'));
    await renderPage();
    expect(screen.getByText('Next bill date unavailable')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'MONTHLY BILL' })).getByText('$60.00')).toBeInTheDocument();
  });

  it('shows the bill, the next bill date, recent orders, the contract and one stored label per plan', async () => {
    const orders = mapped(orderA(), orderB());
    state.orders.mockResolvedValue(orders);
    state.recurring.mockResolvedValue([active(orders[0]!.id, '2026-12-07T10:00:00Z'), active(orders[1]!.id, '2026-11-07T10:00:00Z')]);
    await renderPage();
    expect(screen.getByText('$129.98')).toBeInTheDocument();
    expect(screen.getByText('Next bill Nov 7, 2026')).toBeInTheDocument();
    const recent = screen.getByRole('region', { name: 'Recent orders' });
    expect(within(recent).getByRole('link', { name: 'QA-AAAA01' })).toHaveAttribute('href', '/en-US/account/orders/QA-AAAA01');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('article').map((label) => label.getAttribute('data-plan-id'))).toEqual(['MLV-CA-101', 'MLV-PH-301']);
  });

  it('speaks German', async () => {
    await renderPage('de-DE');
    expect(screen.getByRole('heading', { level: 1, name: 'Hallo Alex' })).toBeInTheDocument();
    expect(screen.getByText('MONATLICHE RECHNUNG')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aktueller Vertrag' })).toBeInTheDocument();
  });
});
