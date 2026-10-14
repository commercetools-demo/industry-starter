// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

vi.mock('@/i18n/routing', () => ({
  Link: ({ href, locale, children, ...rest }: { href: string; locale?: string; children: ReactNode }) => (
    <a href={`/${locale ?? 'en-US'}${href}`} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

import { FinderDrawerProvider, useFinderDrawer } from './FinderDrawerProvider';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ resellers: [{ key: 'mau-reseller-north', name: 'Küstenwerk', city: 'Hamburg', postalCode: '21079', address: 'Hafenstraße 1', branches: [] }] }), { status: 200 })),
  );
  document.body.style.overflow = '';
});

function Openers() {
  const { open, isOpen } = useFinderDrawer();
  return (
    <>
      <button onClick={() => open()}>header</button>
      <button onClick={(e) => open({ productSlug: 'brake-pad-1', opener: e.currentTarget })}>card</button>
      <span data-testid="state">{isOpen ? 'open' : 'closed'}</span>
    </>
  );
}

const setup = () => renderWithProviders(<FinderDrawerProvider locale="en-US"><Openers /></FinderDrawerProvider>, { locale: 'en-US', messages: enUS });

describe('FinderDrawerProvider', () => {
  it('is closed at first and renders no dialog', () => {
    setup();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('state')).toHaveTextContent('closed');
  });

  it('opens from a card with the product: a modal dialog whose rows link to the product', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'card' }));
    const dialog = screen.getByRole('dialog', { name: 'Find your reseller' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('state')).toHaveTextContent('open');
    expect(await screen.findByRole('link', { name: /Küstenwerk/ })).toHaveAttribute('href', '/en-US/mau-reseller-north/p/brake-pad-1');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('opens from the header without a product: rows link to the reseller home', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'header' }));
    expect(await screen.findByRole('link', { name: /Küstenwerk/ })).toHaveAttribute('href', '/en-US/mau-reseller-north');
  });

  it('Escape closes it and returns focus to the opener', async () => {
    const user = userEvent.setup();
    setup();
    const card = screen.getByRole('button', { name: 'card' });
    await user.click(card);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(card).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on the close button and on the scrim', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'header' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'header' }));
    await user.click(screen.getByTestId('finder-scrim'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'header' })).toHaveFocus();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'header' }));
    const dialog = screen.getByRole('dialog');
    await screen.findByRole('link', { name: /Küstenwerk/ });
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 8; i++) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('slides in with a transform that reduced motion switches off, and is a full-width sheet when narrow', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'header' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('motion-reduce:transition-none');
    expect(dialog.className).toContain('transition-transform');
    expect(dialog.className).toContain('max-[40rem]:max-w-none');
    expect(dialog.className).toContain('w-full');
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'open'));
    expect(dialog.className).toContain('translate-x-0');
  });

  it('has no accessibility violations when open', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'header' }));
    await screen.findByRole('link', { name: /Küstenwerk/ });
    expect(await axe(screen.getByRole("dialog"))).toHaveNoViolations();
  });
});

describe('useFinderDrawer outside the provider', () => {
  it('does nothing and reports closed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Openers />, { locale: 'en-US', messages: enUS });
    await user.click(screen.getByRole('button', { name: 'card' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
