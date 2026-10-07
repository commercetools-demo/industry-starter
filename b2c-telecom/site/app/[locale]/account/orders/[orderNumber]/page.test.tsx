import { screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { mapOrder } from '@/lib/mappers/order';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { orderA, orderDevice } from '@/test/fixtures/orders';
import { resolveElement } from '@/test/resolveAsync';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ session: {} as { customerId?: string }, getCustomer: vi.fn(), getOrder: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (arg: string | { locale: string; namespace: string }) =>
    typeof arg === 'string' ? createTranslator({ locale: 'en-US', messages: enMessages, namespace: arg as never }) : createTranslator({ locale: arg.locale, messages: arg.locale === 'de-DE' ? deMessages : enMessages, namespace: arg.namespace as never }),
}));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  redirect: ({ href, locale }: { href: string; locale: string }) => {
    throw new Error(`REDIRECT /${locale}${href}`);
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/ct/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/ct/customer', () => ({ getCustomerById: state.getCustomer, sessionsValidAfterOf: () => undefined }));
vi.mock('@/lib/ct/orders', () => ({ getOrderForCustomer: state.getOrder }));

import OrderPage from './page';
import OrderNotFound from './not-found';

const props = (orderNumber: string, locale: 'en-US' | 'de-DE' = 'en-US') => ({ params: Promise.resolve({ locale, orderNumber }) });

beforeEach(() => {
  vi.clearAllMocks();
  state.session = { customerId: 'cust-alex' };
  state.getCustomer.mockResolvedValue({ id: 'cust-alex', email: 'a@b.c', firstName: 'Alex', lastName: 'Rivera', addresses: [] });
  state.getOrder.mockResolvedValue(mapOrder(orderA(), 'en-US'));
});

describe('order detail page', () => {
  it('Detail of an order not theirs: no order data is returned and the refusal is stated', async () => {
    state.getOrder.mockResolvedValue(null);
    await expect(OrderPage(props('QA-OTHER1'))).rejects.toThrow('NOT_FOUND');
    expect(state.getOrder).toHaveBeenCalledWith('QA-OTHER1', 'cust-alex', 'en-US');
    renderWithProviders(await resolveElement(await OrderNotFound()));
    expect(screen.getByRole('heading', { level: 1, name: 'We could not find that order' })).toBeInTheDocument();
    expect(screen.getByText('It may belong to a different account.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All orders' })).toHaveAttribute('href', '/en-US/account/orders');
  });

  it('asks for the order with the id of the session customer, never one from the request', async () => {
    renderWithProviders(await OrderPage(props('QA-AAAA01')));
    expect(state.getOrder).toHaveBeenCalledTimes(1);
    expect(state.getOrder).toHaveBeenCalledWith('QA-AAAA01', 'cust-alex', 'en-US');
  });

  it('sends anonymous visitors to login with the order as destination, before reading it', async () => {
    state.session = {};
    await expect(OrderPage(props('QA-AAAA01'))).rejects.toThrow('REDIRECT /en-US/login?returnTo=%2Fen-US%2Faccount%2Forders%2FQA-AAAA01');
    expect(state.getOrder).not.toHaveBeenCalled();
  });

  it('tolerates a malformed percent escape in the number (it is just an unknown order)', async () => {
    state.getOrder.mockResolvedValue(null);
    await expect(OrderPage(props('%E0%A4%A'))).rejects.toThrow('NOT_FOUND');
  });

  it('shows the heading, status, service start, items, totals, schedule, stored label, delivery and the actions', async () => {
    renderWithProviders(await OrderPage(props('QA-AAAA01')));
    expect(screen.getByRole('heading', { level: 1, name: 'Order QA-AAAA01' })).toBeInTheDocument();
    expect(screen.getByText('Service start Mar 12, 2026')).toBeInTheDocument();
    expect(screen.getAllByText('Placed').length).toBeGreaterThan(0);
    const items = screen.getByRole('region', { name: 'Order items' });
    expect(within(items).getByRole('row', { name: /^Cable 500/ })).toHaveTextContent('$59.99/mo');
    expect(screen.getAllByText('Due at order').length).toBeGreaterThan(0);
    expect(screen.getByText('Monthly after that')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your agreed prices' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Broadband Facts at the time of your order' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: /Cable 500/ })).toHaveAttribute('data-plan-id', 'MLV-CA-101');
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByText('1 Main St')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print receipt' })).toBeInTheDocument();
    expect(screen.getByText('Receipt for order QA-AAAA01')).toBeInTheDocument();
    expect(screen.getByText('Customer: Alex Rivera')).toBeInTheDocument();
  });

  it('does not offer "Buy again" for a cancelled order', async () => {
    state.getOrder.mockResolvedValue(mapOrder(orderA({ orderState: 'Cancelled' }), 'en-US'));
    renderWithProviders(await OrderPage(props('QA-AAAA01')));
    expect(screen.queryByRole('button', { name: 'Buy again' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print receipt' })).toBeInTheDocument();
  });

  it('says a plan has no label when its order stored none', async () => {
    state.getOrder.mockResolvedValue(mapOrder(orderDevice(), 'en-US'));
    renderWithProviders(await OrderPage(props('QA-DDDD04')));
    expect(screen.getByText(/Label not available for this order\./)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('speaks German', async () => {
    renderWithProviders(await OrderPage(props('QA-AAAA01', 'de-DE')), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Bestellung QA-AAAA01' })).toBeInTheDocument();
    expect(screen.getByText('Servicebeginn 12.03.2026')).toBeInTheDocument();
  });
});
