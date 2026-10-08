import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SWRConfig } from 'swr';
import { KEY_ACCOUNT, KEY_CART } from '@/lib/cache-keys';
import { renderWithProviders, screen, within } from '@/test/utils';
import { setPathname } from '@/test/navigation-mock';

vi.mock('next/navigation', async (importOriginal) =>
  (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()),
);

import { Header } from './Header';

function withState(state: Record<string, unknown>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SWRConfig value={{ fallback: state }}>{children}</SWRConfig>;
  };
}

const cart = (lineCount: number, itemCount = lineCount) => ({ id: 'k', version: 1, itemCount, lineCount, currencyCode: 'USD' });

function renderHeader(path: string, state: Record<string, unknown> = {}, props: Parameters<typeof Header>[0] = {}) {
  setPathname(path);
  const Wrapper = withState(state);
  return renderWithProviders(
    <Wrapper>
      <Header {...props} />
    </Wrapper>,
  );
}

describe('design-storefront-shell › Header navigation', () => {
  it('Anonymous visitor: "Sign in" button and no cart count', () => {
    renderHeader('/en-US/doctors/remote');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en-US/login');
    const cartLink = screen.getByRole('link', { name: 'Cart' });
    expect(cartLink).toHaveAttribute('href', '/en-US/cart');
    expect(cartLink.querySelector('[data-cart-count]')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Your account' })).toBeNull();
  });

  it('Signed-in patient: 36 px initials avatar linking to the account and a count of cart LINES', () => {
    renderHeader('/en-US/doctors/remote', {
      [KEY_ACCOUNT]: { id: 'c1', firstName: 'Sam', lastName: 'Rivera' },
      [KEY_CART]: cart(2, 7),
    });
    const account = screen.getByRole('link', { name: 'Your account' });
    expect(account).toHaveAttribute('href', '/en-US/account');
    expect(account).toHaveTextContent('SR');
    expect(account.querySelector('[data-size="sm"]')).toHaveClass('size-9');
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    const bubble = screen.getByRole('link', { name: /^Cart/ }).querySelector('[data-cart-count]');
    expect(bubble).toHaveTextContent('2'); // two lines with a total quantity of seven
    expect(screen.getByRole('link', { name: 'Cart, 2 items in cart' })).toBeInTheDocument();
  });

  it('Signed-in patient with an empty or missing cart: no count bubble', () => {
    renderHeader('/en-US/prescriptions', { [KEY_ACCOUNT]: { id: 'c1', firstName: 'Sam', lastName: 'Rivera' }, [KEY_CART]: null });
    expect(screen.getByRole('link', { name: 'Cart' }).querySelector('[data-cart-count]')).toBeNull();
    renderHeader('/en-US/prescriptions', { [KEY_CART]: cart(0) });
    expect(screen.getAllByRole('link', { name: 'Cart' }).at(-1)?.querySelector('[data-cart-count]')).toBeNull();
  });

  it('shows the sticky 72 px bar with white 95% and blur', () => {
    const { container } = renderHeader('/en-US/doctors/remote');
    const header = container.querySelector('header');
    expect(header).toHaveClass('sticky', 'top-0', 'bg-surface/95', 'backdrop-blur-sm');
    expect(header?.firstElementChild).toHaveClass('h-18');
  });

  it('primary links are real links in the prescribed order', () => {
    renderHeader('/en-US/doctors/remote');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Remote sessions', 'Office visits', 'Prescriptions', 'Lab tests']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/en-US/doctors/remote',
      '/en-US/doctors/office',
      '/en-US/prescriptions',
      '/en-US/account/labs',
    ]);
  });

  it.each([
    ['/en-US/doctors/remote', 'Remote sessions'],
    ['/en-US/doctors/office', 'Office visits'],
    ['/en-US/prescriptions', 'Prescriptions'],
    ['/en-US/cart', 'Prescriptions'],
    ['/en-US/checkout', 'Prescriptions'],
    ['/en-US/order/o1', 'Prescriptions'],
    ['/en-US/account/labs', 'Lab tests'],
  ])('Active section: %s marks "%s" only', (path, label) => {
    renderHeader(path);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const current = within(nav).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((l) => l.textContent)).toEqual([label]);
    expect(current[0]).toHaveClass('aria-[current=page]:border-brand-500', 'aria-[current=page]:text-brand-600');
  });

  it('Active section: no link is active on the account overview', () => {
    renderHeader('/en-US/account');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').some((l) => l.hasAttribute('aria-current'))).toBe(false);
  });

  it('Home header variant: Home link, no cart/avatar, "Sign in" outline and "Book a visit" primary, links into the app', () => {
    renderHeader('/en-US');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Home',
      'Remote sessions',
      'Office visits',
      'Prescriptions',
      'Lab tests',
    ]);
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    const signIn = screen.getAllByRole('link', { name: 'Sign in' })[0];
    expect(signIn).toHaveAttribute('data-variant', 'outline');
    const book = screen.getAllByRole('link', { name: 'Book a visit' })[0];
    expect(book).toHaveAttribute('data-variant', 'primary');
    expect(book).toHaveAttribute('href', '/en-US/doctors/remote');
    expect(screen.queryByRole('link', { name: /^Cart/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Your account' })).toBeNull();
  });

  it('Home header variant: Health journal appears only when articles exist', () => {
    renderHeader('/en-US', {}, { hasArticles: false });
    expect(screen.queryByRole('link', { name: 'Health journal' })).toBeNull();
    renderHeader('/en-US', {}, { hasArticles: true });
    expect(screen.getAllByRole('link', { name: 'Health journal' }).length).toBeGreaterThan(0);
  });

  it('an explicit variant overrides the route', () => {
    renderHeader('/en-US/doctors/remote', {}, { variant: 'home' });
    expect(screen.getAllByRole('link', { name: 'Book a visit' }).length).toBeGreaterThan(0);
  });

  it('the logo links to /en-US (Q-021) and is the first tab stop; Cart then Sign in follow the links', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    renderHeader('/en-US/doctors/remote');
    const logo = screen.getByRole('link', { name: 'Malva home' });
    expect(logo).toHaveAttribute('href', '/en-US');
    await userEvent.tab();
    expect(logo).toHaveFocus();
    const order: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await userEvent.tab();
      order.push(document.activeElement?.textContent ?? '');
    }
    expect(order.slice(0, 6)).toEqual(['Remote sessions', 'Office visits', 'Prescriptions', 'Lab tests', 'Cart', 'Sign in']);
  });
});

describe('design-storefront-shell › Session-resolved header state', () => {
  it('Expired session: the layout fallback is empty, so the header is anonymous with no stale count or initials', () => {
    // An expired token yields an empty session (see lib/session-core.test.ts), so the root layout
    // builds an empty fallback: nothing of the previous visitor can reach the header.
    renderHeader('/en-US/doctors/remote', {});
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cart' }).querySelector('[data-cart-count]')).toBeNull();
    expect(screen.queryByText(/^[A-Z]{2}$/)).toBeNull();
  });

  it('after sign-out the cleared (null) state shows no count or initials even if a fallback had them', () => {
    renderHeader('/en-US/doctors/remote', { [KEY_ACCOUNT]: null, [KEY_CART]: null });
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cart' }).querySelector('[data-cart-count]')).toBeNull();
  });

  it('the header server shell has no per-visitor value in its own markup (islands only)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(import.meta.dirname, 'Header.tsx'), 'utf8');
    expect(source).not.toMatch(/getSession|lib\/session|lib\/ct|itemCount|lineCount|firstName/);
    expect(source).not.toMatch(/['"]use client['"]/);
  });
});
