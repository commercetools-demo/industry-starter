import type { ReactNode } from 'react';
import { act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEY_ACCOUNT, KEY_CART } from '@/lib/cache-keys';
import { NAV_BREAKPOINT_PX } from '@/lib/nav';
import { renderWithProviders, screen, within } from '@/test/utils';
import { setPathname } from '@/test/navigation-mock';

vi.mock('next/navigation', async (importOriginal) =>
  (await import('@/test/navigation-mock')).navigationMock(await importOriginal<object>()),
);

import { Header } from './Header';

/** Minimal matchMedia: the viewport width decides `(min-width: Npx)`; `resize` fires change events. */
function installViewport(initialWidth: number) {
  let width = initialWidth;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const matches = (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return min ? width >= Number(min[1]) : false;
  };
  window.matchMedia = vi.fn((query: string) => ({
    media: query,
    get matches() {
      return matches(query);
    },
    addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
  return {
    resize(next: number) {
      width = next;
      act(() => {
        listeners.forEach((fn) => fn({ matches: next >= NAV_BREAKPOINT_PX } as MediaQueryListEvent));
      });
    },
  };
}

function renderHeader(path: string, state: Record<string, unknown> = {}) {
  setPathname(path);
  const Wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ fallback: state }}>{children}</SWRConfig>;
  return renderWithProviders(
    <Wrapper>
      <Header />
    </Wrapper>,
  );
}

describe('design-storefront-shell › Header navigation › Narrow screens', () => {
  let viewport: ReturnType<typeof installViewport>;
  beforeEach(() => {
    viewport = installViewport(390);
  });
  afterEach(() => {
    // @ts-expect-error restore the jsdom default (no matchMedia)
    delete window.matchMedia;
  });

  it('under 900 px the primary links collapse into a menu button; the logo stays first', () => {
    const { container } = renderHeader('/en-US/doctors/remote');
    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    // CSS hides the inline row below the breakpoint and the button at or above it.
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveClass('max-nav:hidden');
    expect(button).toHaveClass('nav:hidden');
    expect(container.querySelector('header a')).toHaveAttribute('aria-label', 'Malva home');
    expect(document.querySelector('[data-mobile-menu]')).not.toBeVisible();
  });

  it('opens a panel with the links, Cart and Sign in; focus moves to the first link', async () => {
    renderHeader('/en-US/doctors/office');
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const panel = document.querySelector<HTMLElement>('[data-mobile-menu]') as HTMLElement;
    expect(panel).toBeVisible();
    const menu = within(panel).getByRole('navigation', { name: 'Menu' });
    expect(within(menu).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Remote sessions',
      'Office visits',
      'Prescriptions',
      'Lab tests',
      'Cart',
      'Sign in',
    ]);
    expect(within(menu).getByRole('link', { name: 'Office visits' })).toHaveAttribute('aria-current', 'page');
    expect(within(menu).getByRole('link', { name: 'Remote sessions' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('signed in: the panel shows the account link and the cart line count', async () => {
    renderHeader('/en-US/doctors/office', {
      [KEY_ACCOUNT]: { id: 'c1', firstName: 'Sam', lastName: 'Rivera' },
      [KEY_CART]: { id: 'k', version: 1, itemCount: 5, lineCount: 3, currencyCode: 'USD' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = within(document.querySelector<HTMLElement>('[data-mobile-menu]') as HTMLElement).getByRole('navigation', { name: 'Menu' });
    expect(within(menu).getByRole('link', { name: 'Cart, 3 items in cart' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Your account' })).toHaveAttribute('href', '/en-US/account');
    expect(within(menu).queryByRole('link', { name: 'Sign in' })).toBeNull();
  });

  it('Escape closes it and returns focus to the menu button', async () => {
    renderHeader('/en-US/doctors/remote');
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.keyboard('{Escape}');
    expect(document.querySelector('[data-mobile-menu]')).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveFocus();
  });

  it('the button toggles it (keyboard: Enter)', async () => {
    renderHeader('/en-US/doctors/remote');
    const button = screen.getByRole('button', { name: 'Open menu' });
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(document.querySelector('[data-mobile-menu]')).toBeVisible();
    await userEvent.keyboard('{Enter}');
    expect(document.querySelector('[data-mobile-menu]')).not.toBeVisible();
  });

  it('following a link closes it', async () => {
    renderHeader('/en-US/doctors/remote');
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const panel = document.querySelector<HTMLElement>('[data-mobile-menu]') as HTMLElement;
    document.addEventListener('click', (event) => event.preventDefault(), { once: true }); // no jsdom navigation
    await userEvent.click(within(panel).getByRole('link', { name: 'Prescriptions' }));
    expect(panel).not.toBeVisible();
  });

  it('widening the viewport to 900 px closes it', async () => {
    renderHeader('/en-US/doctors/remote');
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(document.querySelector('[data-mobile-menu]')).toBeVisible();
    viewport.resize(NAV_BREAKPOINT_PX);
    expect(document.querySelector('[data-mobile-menu]')).not.toBeVisible();
    expect(window.matchMedia).toHaveBeenCalledWith(`(min-width: ${NAV_BREAKPOINT_PX}px)`);
  });

  it('home variant: the panel offers "Book a visit" and "Sign in" instead of Cart', async () => {
    renderHeader('/en-US');
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = within(document.querySelector<HTMLElement>('[data-mobile-menu]') as HTMLElement).getByRole('navigation', { name: 'Menu' });
    const names = within(menu).getAllByRole('link').map((l) => l.textContent);
    expect(names).toContain('Book a visit');
    expect(names).toContain('Sign in');
    expect(names).not.toContain('Cart');
  });
});
