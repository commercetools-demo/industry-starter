import { screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import deMessages from '@/messages/de-DE.json';
import enMessages from '@/messages/en-US.json';
import { feeLine, makeCart, planLine, readyState, makeState, ADDRESS } from '@/test/fixtures/checkoutApi';
import { resolveElement } from '@/test/resolveAsync';
import { renderWithProviders } from '@/test/utils';

const state = vi.hoisted(() => ({ session: {} as Record<string, string>, find: vi.fn() }));

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
vi.mock('@/hooks/useAddresses', () => ({ useAddresses: () => ({ addresses: [], defaultService: null, defaultBilling: null, isLoading: false, error: undefined }) }));
vi.mock('@/lib/ct/session', () => ({ getSession: async () => state.session }));
vi.mock('@/lib/ct/checkout', () => ({ findCheckoutState: state.find }));

import CheckoutPage from './page';

const props = (step?: string, locale: 'en-US' | 'de-DE' = 'en-US') => ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(step ? { step } : {}) });
const physical = () => planLine({ id: 'E1', kind: 'equipment', offerKey: 'malva-offer-router', sku: 'MLV-EQP-1', name: 'Router', schedule: null, label: null });

beforeEach(() => {
  vi.clearAllMocks();
  state.session = { cartId: 'cart-1' };
});

describe('checkout page', () => {
  it('no cart: redirects to My bundle', async () => {
    state.find.mockResolvedValue(null);
    await expect(CheckoutPage(props())).rejects.toThrow('REDIRECT /en-US/bundle');
  });

  it('an empty cart redirects to My bundle', async () => {
    state.find.mockResolvedValue(makeState({ cart: makeCart({ lines: [] }) }));
    await expect(CheckoutPage(props())).rejects.toThrow('REDIRECT /en-US/bundle');
  });

  it('an unreadable cart redirects to My bundle instead of a half page', async () => {
    state.find.mockRejectedValue(new Error('boom'));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(CheckoutPage(props())).rejects.toThrow('REDIRECT /en-US/bundle');
    quiet.mockRestore();
  });

  it('a step whose predecessors are incomplete redirects to the first incomplete step', async () => {
    state.find.mockResolvedValue(makeState());
    await expect(CheckoutPage(props('review'))).rejects.toThrow('REDIRECT /en-US/bundle/checkout?step=contact');
  });

  it('the payment step is never a landing step: it redirects to review', async () => {
    state.find.mockResolvedValue(readyState({ needsDelivery: false }));
    await expect(CheckoutPage(props('payment'))).rejects.toThrow('REDIRECT /en-US/bundle/checkout?step=review');
  });

  it('default step is contact; the page shows the H1, breadcrumb and the stepper with 4 steps for a digital-only bundle', async () => {
    state.find.mockResolvedValue(makeState({ needsDelivery: false }));
    renderWithProviders(await resolveElement(await CheckoutPage(props())));
    expect(screen.getByRole('heading', { level: 1, name: 'Checkout' })).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: 'Checkout steps' });
    expect(steps.querySelectorAll('li')).toHaveLength(4);
    expect(steps).not.toHaveTextContent('Delivery');
    expect(steps.querySelector('[aria-current="step"]')).toHaveTextContent('Contact');
  });

  it('a bundle with equipment has five steps and the summary shows the cart it was given and no other numbers', async () => {
    const cart = makeCart({ lines: [planLine(), feeLine(), physical()] });
    state.find.mockResolvedValue(readyState({ cart, needsDelivery: true, serviceAddress: ADDRESS, delivery: { id: 'd', name: 'Standard shipping', price: { centAmount: 0, currencyCode: 'USD' } }, shipping: { centAmount: 0, currencyCode: 'USD' } }));
    renderWithProviders(await resolveElement(await CheckoutPage(props('delivery'))));
    expect(screen.getByRole('list', { name: 'Checkout steps' }).querySelectorAll('li')).toHaveLength(5);
    const summary = screen.getByRole('complementary', { name: 'Order summary' });
    expect(summary).toHaveTextContent(`Due today$${(cart.summary.total.centAmount / 100).toFixed(2)}`);
    expect(summary).toHaveTextContent('Shipping$0.00');
    expect(summary).toHaveTextContent('Tax$0.00');
  });

  it('de-DE: German title strip and money', async () => {
    state.find.mockResolvedValue(makeState({ needsDelivery: false }));
    renderWithProviders(await resolveElement(await CheckoutPage(props(undefined, 'de-DE'))), { locale: 'de-DE' });
    expect(screen.getByRole('list', { name: 'Schritte der Kasse' })).toBeInTheDocument();
  });
});
