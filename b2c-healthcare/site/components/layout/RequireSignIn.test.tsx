import { describe, expect, it, vi } from 'vitest';
import { sanitizeNext } from '@/lib/next-path';
import { renderWithProviders, screen } from '@/test/utils';
import { setPathname } from '@/test/navigation-mock';

vi.mock('next/navigation', async (importOriginal) =>
  (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()),
);

import { RequireSignIn, type SignInReason } from './RequireSignIn';

const REASONS: Array<[SignInReason, string, string]> = [
  ['cart', '/en-US/cart', 'Sign in to view your cart.'],
  ['prescriptions', '/en-US/prescriptions', 'Sign in to look up your prescriptions.'],
  ['checkout', '/en-US/checkout', 'Sign in to check out.'],
  ['order', '/en-US/order/o1', 'Sign in to view your order.'],
  ['labs', '/en-US/account/labs', 'Sign in to see your lab tests.'],
  ['account', '/en-US/account', 'Sign in to open your account.'],
];

describe('design-storefront-shell › Protected routes prompt in place', () => {
  it.each(REASONS)('reason %s says "%s" and returns to the route after sign-in', (reason, path, text) => {
    setPathname(path);
    renderWithProviders(<RequireSignIn reason={reason} />);
    expect(screen.getByRole('heading', { name: 'Sign in to Malva' })).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Sign in' });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('/en-US/login?next=')).toBe(true);
    const next = new URL(href, 'http://localhost').searchParams.get('next');
    expect(next).toBe(path);
    expect(sanitizeNext(next)).toBe(path);
  });

  it('Cart while signed out: the card shows "Sign in to view your cart." and the link returns to /cart', () => {
    setPathname('/en-US/cart');
    renderWithProviders(<RequireSignIn reason="cart" />);
    expect(screen.getByText('Sign in to view your cart.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en-US/login?next=%2Fen-US%2Fcart');
  });

  it('an explicit returnTo wins over the current route', () => {
    setPathname('/en-US/checkout');
    renderWithProviders(<RequireSignIn reason="order" returnTo="/order/abc" />);
    const next = new URL(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href') ?? '', 'http://localhost').searchParams.get('next');
    expect(next).toBe('/en-US/order/abc');
  });

  it('is a real link inside a card, reachable by keyboard', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    setPathname('/en-US/cart');
    renderWithProviders(<RequireSignIn reason="cart" />);
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveFocus();
  });
});
