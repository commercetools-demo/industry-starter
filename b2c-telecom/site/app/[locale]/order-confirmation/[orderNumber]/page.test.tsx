import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { mapOrder } from '@/lib/mappers/order';
import type { OrderConfirmationView } from '@/lib/types';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { orderA } from '@/test/fixtures/orders';
import { resolveElement } from '@/test/resolveAsync';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({
  session: {} as { customerId?: string; lastOrderNumber?: string; pendingOrderNumber?: string; cartId?: string },
  getOrder: vi.fn(),
  resolveReturn: vi.fn(),
  refresh: vi.fn(),
}));

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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: state.refresh }),
}));
vi.mock('@/lib/ct/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/ct/checkout', () => ({ getOrderForConfirmation: state.getOrder, resolveReturnTarget: state.resolveReturn }));

import OrderConfirmationPage from './page';

const NUMBER = 'MLV-7K3F9QXD';
const props = (orderNumber: string, query: Record<string, string> = {}, locale: 'en-US' | 'de-DE' = 'en-US') => ({ params: Promise.resolve({ locale, orderNumber }), searchParams: Promise.resolve(query) });
const storedView = (patch: Partial<OrderConfirmationView> = {}): OrderConfirmationView => ({
  order: { ...mapOrder(orderA(), 'en-US'), orderNumber: NUMBER },
  full: false,
  owner: false,
  email: null,
  isGuest: false,
  paymentState: 'Paid',
  ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  state.session = {};
  state.getOrder.mockResolvedValue(storedView());
});

describe('order confirmation page', () => {
  it('Placement outcome unknown: pending order number shows a single retry path and no second order exists', async () => {
    state.session = { pendingOrderNumber: NUMBER, cartId: 'cart-1' };
    state.getOrder.mockResolvedValue(null);
    renderWithProviders(await resolveElement(await OrderConfirmationPage(props(NUMBER))));
    expect(screen.getByRole('heading', { name: `We're checking on your order ${NUMBER}` })).toBeInTheDocument();
    expect(screen.getByText('If you were charged, it will appear here shortly.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Check again' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to payment' })).toHaveAttribute('href', '/en-US/bundle/checkout?step=review');
    // reading is the only thing the page does: the order is looked up, nothing is created
    expect(state.getOrder).toHaveBeenCalledTimes(1);
    screen.getByRole('button', { name: 'Check again' }).click();
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });

  it('an unknown number without a pending order is not found', async () => {
    state.getOrder.mockResolvedValue(null);
    await expect(OrderConfirmationPage(props(NUMBER))).rejects.toThrow('NOT_FOUND');
  });

  it('a malformed number is not found and nothing is read', async () => {
    await expect(OrderConfirmationPage(props('bad'))).rejects.toThrow('NOT_FOUND');
    expect(state.getOrder).not.toHaveBeenCalled();
  });

  it('Revisited later: renders from the stored order without a cart or the placing session', async () => {
    state.session = {}; // no cart, no session at all
    renderWithProviders(await resolveElement(await OrderConfirmationPage(props(NUMBER))));
    expect(state.getOrder).toHaveBeenCalledWith({}, NUMBER);
    expect(screen.getByRole('heading', { level: 2, name: 'Order placed.' })).toBeInTheDocument();
    expect(screen.getByText(/Sign in as the buyer to see the full order/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View order' })).not.toBeInTheDocument();
  });

  it('Revisited later: the owner (or the session that placed the order) sees the full view', async () => {
    state.session = { customerId: 'cust-alex' };
    state.getOrder.mockResolvedValue(storedView({ full: true, owner: true, email: 'alex@example.com' }));
    renderWithProviders(await resolveElement(await OrderConfirmationPage(props(NUMBER))));
    expect(screen.getByText('Confirmation for alex@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View order' })).toHaveAttribute('href', `/en-US/account/orders/${NUMBER}`);
  });

  it('the hosted Checkout return URL redirects by order number or by order id', async () => {
    state.resolveReturn.mockResolvedValue(NUMBER);
    await expect(OrderConfirmationPage(props('return', { orderNumber: NUMBER }))).rejects.toThrow(`REDIRECT /en-US/order-confirmation/${NUMBER}`);
    expect(state.resolveReturn).toHaveBeenCalledWith({ orderNumber: NUMBER });
    await expect(OrderConfirmationPage(props('return', { orderId: 'o-1' }))).rejects.toThrow(`REDIRECT /en-US/order-confirmation/${NUMBER}`);
    expect(state.resolveReturn).toHaveBeenLastCalledWith({ orderId: 'o-1' });
  });

  it('a return URL that names no order is not found', async () => {
    state.resolveReturn.mockResolvedValue(null);
    await expect(OrderConfirmationPage(props('return'))).rejects.toThrow('NOT_FOUND');
  });

  it('de-DE: the order is shown in German', async () => {
    renderWithProviders(await resolveElement(await OrderConfirmationPage(props(NUMBER, {}, 'de-DE'))), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 2, name: 'Bestellung aufgegeben.' })).toBeInTheDocument();
  });
});
