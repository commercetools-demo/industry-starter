import { createTranslator } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPathname } from '@/test/navigation-mock';
import messages from '@/messages/en-US.json';
import { renderWithProviders, screen } from '@/test/utils';

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async ({ namespace }: { namespace: string }) => createTranslator({ locale: 'en-US', messages, namespace: namespace as 'cart' }),
}));
const getSession = vi.fn();
vi.mock('@/lib/session', () => ({ getSession: () => getSession() }));
vi.mock('next/navigation', async (importOriginal) => (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()));

import ProtectedLayout from '../layout';
import CartRoute, { generateMetadata } from './page';

const params = Promise.resolve({ locale: 'en-US' });
const renderCart = async () => renderWithProviders(<>{await ProtectedLayout({ children: await CartRoute({ params }) })}</>);

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  setPathname('/en-US/cart');
  getSession.mockReset();
  fetchMock = vi.fn().mockResolvedValue(new Response('null'));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('design-cart › Cart page layout', () => {
  it('Anonymous visitor: the sign-in card says "Sign in to view your cart." and returns to the cart; nothing is requested', async () => {
    getSession.mockResolvedValue({});
    await renderCart();
    expect(screen.getByText('Sign in to view your cart.')).toBeInTheDocument();
    const href = screen.getByRole('link', { name: 'Sign in' }).getAttribute('href') ?? '';
    expect(new URL(href, 'http://x.test').searchParams.get('next')).toBe('/en-US/cart');
    expect(screen.queryByRole('heading', { name: 'Your cart' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a signed-in patient gets the cart page, which is never indexed', async () => {
    getSession.mockResolvedValue({ customerId: 'c1' });
    await renderCart();
    expect(await screen.findByRole('heading', { level: 1, name: 'Your cart' })).toBeInTheDocument();
    expect(await generateMetadata({ params })).toMatchObject({ title: 'Your cart', robots: { index: false, follow: false } });
  });
});
