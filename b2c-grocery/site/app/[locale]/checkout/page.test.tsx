import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCart } from '@/test/cart';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/lib/session', () => ({ getSession: vi.fn(), getMarket: vi.fn() }));
vi.mock('@/lib/ct/cart', () => ({ getMappedCart: vi.fn() }));
vi.mock('next-intl/server', async () => {
  const messages = (await import('@/messages/en-US.json')).default;
  const { createTranslator } = await import('next-intl');
  return {
    setRequestLocale: vi.fn(),
    getTranslations: async ({ namespace }: { namespace: string }) => createTranslator({ locale: 'en-US', messages, namespace: namespace as never }),
  };
});
const redirect = vi.fn((arg: { href: string; locale: string }) => {
  throw new Error(`REDIRECT ${arg.locale} ${arg.href}`);
});
vi.mock('@/i18n/routing', async (orig) => ({
  ...(await orig<typeof import('@/i18n/routing')>()),
  redirect: (arg: { href: string; locale: string }) => redirect(arg),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/components/checkout/CheckoutFlow', () => ({ CheckoutFlow: () => <div data-testid="flow" /> }));

import CheckoutPage from './page';
import { getMappedCart } from '@/lib/ct/cart';
import { getMarket, getSession } from '@/lib/session';

const params = Promise.resolve({ locale: 'en-US' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMarket).mockResolvedValue({ country: 'US', currency: 'USD', locale: 'en-US' });
});

describe('checkout page', () => {
  it('Empty session cart: no cart id redirects to the bag', async () => {
    vi.mocked(getSession).mockResolvedValue({});
    await expect(CheckoutPage({ params })).rejects.toThrow('REDIRECT en-US /cart');
    expect(getMappedCart).not.toHaveBeenCalled();
  });

  it('cart that is gone or empty redirects to the bag', async () => {
    vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
    vi.mocked(getMappedCart).mockResolvedValueOnce(null);
    await expect(CheckoutPage({ params })).rejects.toThrow('REDIRECT en-US /cart');
    vi.mocked(getMappedCart).mockResolvedValueOnce(makeCart({ lines: [] }));
    await expect(CheckoutPage({ params })).rejects.toThrow('REDIRECT en-US /cart');
  });

  it('renders the frame: kicker, heading and the hosted flow (no summary of ours)', async () => {
    vi.mocked(getSession).mockResolvedValue({ cartId: 'cart-1' });
    vi.mocked(getMappedCart).mockResolvedValue(makeCart());
    renderWithProviders(await CheckoutPage({ params }));
    expect(screen.getByRole('heading', { level: 1, name: 'Checkout' })).toBeInTheDocument();
    expect(screen.getByText('Checkout', { selector: 'h6' })).toBeInTheDocument();
    expect(screen.queryByText('Whole milk 1 L')).not.toBeInTheDocument();
    expect(screen.getByTestId('flow')).toBeInTheDocument();
    expect(getMappedCart).toHaveBeenCalledWith('cart-1', { country: 'US', currency: 'USD', locale: 'en-US' });
  });
});
