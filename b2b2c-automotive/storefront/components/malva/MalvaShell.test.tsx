// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/',
}));
vi.mock('@/components/malva/FinderDrawerProvider', () => ({
  FinderDrawerProvider: ({ locale, children }: { locale: string; children: ReactNode }) => <div data-testid="drawer-host" data-locale={locale}>{children}</div>,
  useFinderDrawer: () => ({ open: vi.fn(), close: vi.fn(), isOpen: false }),
}));

import { MalvaShell } from './MalvaShell';

const show = (categories = [{ id: 'c1', slug: 'brakes', name: 'Brakes' }]) =>
  renderWithProviders(
    <MalvaShell locale="en-US" categories={categories}>
      <p>page</p>
    </MalvaShell>,
    { locale: 'en-US', messages: enUS },
  );

describe('Malva shell', () => {
  it('wraps header, page and footer in the finder drawer host', () => {
    show();
    const host = screen.getByTestId('drawer-host');
    expect(host).toHaveAttribute('data-locale', 'en-US');
    expect(host).toContainElement(screen.getByRole('banner'));
    expect(host).toContainElement(screen.getByText('page'));
    expect(host).toContainElement(screen.getByRole('contentinfo'));
    expect(screen.getByRole('link', { name: 'Brakes' })).toBeInTheDocument();
  });
  it('without categories (outage) the page still renders', () => {
    show([]);
    expect(screen.getByText('page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find your reseller' })).toBeInTheDocument();
  });
  it('renders no reseller chrome: no cart, no store chip', () => {
    show();
    expect(screen.queryByRole('link', { name: /cart/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /your store/i })).toBeNull();
  });
});
