import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { resolveElement } from '@/test/resolveAsync';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ session: {} as { customerId?: string }, getCustomer: vi.fn(), list: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async (arg: { locale: string; namespace: string }) => createTranslator({ locale: arg.locale, messages: arg.locale === 'de-DE' ? deMessages : enMessages, namespace: arg.namespace as never }),
}));
vi.mock('@/i18n/routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/routing')>()),
  redirect: ({ href, locale }: { href: string; locale: string }) => { throw new Error(`REDIRECT /${locale}${href}`); },
}));
vi.mock('@/lib/ct/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/ct/customer', () => ({ getCustomerById: state.getCustomer, sessionsValidAfterOf: () => undefined }));
vi.mock('@/lib/ct/payment-methods', () => ({ listPaymentMethods: state.list }));

import PaymentMethodsPage from './page';

const render = async (locale: 'en-US' | 'de-DE' = 'en-US') => renderWithProviders(await resolveElement(await PaymentMethodsPage({ params: Promise.resolve({ locale }) })), { locale });

beforeEach(() => {
  vi.clearAllMocks();
  state.session = { customerId: 'cust-1' };
  state.getCustomer.mockResolvedValue({ id: 'cust-1', email: 'a@b.co', addresses: [] });
  state.list.mockResolvedValue([]);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('payment methods page', () => {
  it('sends an anonymous visitor to sign in and returns here afterwards', async () => {
    state.session = {};
    await expect(PaymentMethodsPage({ params: Promise.resolve({ locale: 'en-US' }) })).rejects.toThrow('REDIRECT /en-US/login?returnTo=%2Fen-US%2Faccount%2Fpayment-methods');
  });
  it('shows the empty state when the customer holds no method', async () => {
    await render();
    expect(screen.getByRole('heading', { level: 1, name: 'Payment methods' })).toBeInTheDocument();
    expect(screen.getByText('No saved payment methods')).toBeInTheDocument();
  });
  it('says the methods are temporarily unavailable when the storefront client may not read them', async () => {
    state.list.mockRejectedValue(Object.assign(new Error('forbidden'), { name: 'PaymentMethodsForbiddenError' }));
    await render();
    expect(screen.getByText('Saved payment methods are temporarily unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('No saved payment methods')).not.toBeInTheDocument();
  });
  it('is German in de-DE', async () => {
    await render('de-DE');
    expect(screen.getByRole('heading', { level: 1, name: 'Zahlungsmethoden' })).toBeInTheDocument();
  });
});
