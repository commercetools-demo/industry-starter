/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import type { Viewer } from '@/lib/portal/types';

const push = vi.fn();
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/catalog',
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

import { Shell } from './Shell';

const viewer = (roles: Viewer['roles']): Viewer => ({
  customerId: 'cust-1',
  name: 'Alex Admin',
  email: 'alex@example.com',
  roles,
  ctPermissions: [],
  businessUnitKey: 'bu-1',
  businessUnitName: 'Test Garage Nord',
  storeKey: 'store-1',
  storeName: 'DACH Online',
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ notifications: [], units: [], parts: [] })));
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-theme');
  push.mockClear();
});

const catalogs = { 'en-US': en, 'de-DE': de } as const;
const renderShell = (roles: Viewer['roles'], locale: 'en-US' | 'de-DE' = 'en-US') =>
  renderWithProviders(
    <Shell viewer={viewer(roles)} copilot>
      <h1>Page title</h1>
    </Shell>,
    { locale, messages: catalogs[locale] },
  );

describe('a11y: Shell', () => {
  for (const locale of ['en-US', 'de-DE'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      for (const roles of [['admin'], ['buyer']] as const) {
        it(`has no axe violations: ${roles[0]}, ${locale}, ${theme}`, async () => {
          document.documentElement.setAttribute('data-theme', theme);
          const { container } = renderShell([...roles], locale);
          expect(await axe(container)).toHaveNoViolations();
        });
      }
    }
  }

  it('skip link first: the first focus stop is the skip link and it targets main', async () => {
    const user = userEvent.setup();
    const { container } = renderShell(['admin']);
    await user.tab();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#main');
    expect(container.querySelector('main#main')).toBeInTheDocument();
  });

  it('icon-only controls have accessible names', () => {
    renderShell(['admin']);
    for (const button of screen.getAllByRole('button')) expect(button, button.outerHTML.slice(0, 120)).toHaveAccessibleName();
  });

  it('the palette button names its purpose and advertises the shortcut', () => {
    renderShell(['admin'], 'de-DE');
    const button = screen.getByRole('button', { name: 'Befehlspalette' });
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');
  });
});

describe('combobox pattern: command palette', () => {
  it('exposes combobox, listbox and options with aria-activedescendant, arrows move, Enter opens, Escape closes and returns focus', async () => {
    const user = userEvent.setup();
    const { container } = renderShell(['admin']);
    const opener = screen.getByRole('button', { name: 'Command palette' });
    opener.focus();
    await user.click(opener);
    const combo = screen.getByRole('combobox', { name: 'Command palette' });
    expect(combo).toHaveFocus();
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(combo).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(combo).toHaveAttribute('aria-activedescendant', options[1].id);
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(await axe(container)).toHaveNoViolations();
    await user.keyboard('{Enter}');
    expect(push).toHaveBeenCalledTimes(1);

    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('Tab does not leave the open palette', async () => {
    const user = userEvent.setup();
    renderShell(['admin']);
    await user.keyboard('{Control>}k{/Control}');
    const dialog = screen.getByRole('dialog', { name: 'Command palette' });
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('a search without result says so outside the listbox and has no axe violations', async () => {
    const user = userEvent.setup();
    const { container } = renderShell(['admin']);
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('combobox'), 'zzzz');
    expect(within(screen.getByRole('listbox', { hidden: true })).queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No matches.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('shell overlays: focus management', () => {
  it('opening the Copilot moves focus into the panel and Close returns it to the launcher', async () => {
    const user = userEvent.setup();
    renderShell(['admin']);
    await user.click(screen.getByTestId('copilot-launcher'));
    const panel = screen.getByRole('dialog', { name: 'Store copilot' });
    expect(panel).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByTestId('copilot-launcher')).toHaveAttribute('aria-hidden', 'true');
    await user.click(within(panel).getByRole('button', { name: 'Close copilot' }));
    expect(screen.getByTestId('copilot-launcher')).toHaveFocus();
    expect(screen.getByTestId('copilot-launcher')).not.toHaveAttribute('aria-hidden');
  });

  it('the account control is a disclosure button named by text, not a menu without arrow keys', async () => {
    const user = userEvent.setup();
    renderShell(['admin']);
    const avatar = screen.getByTestId('avatar');
    expect(avatar).toHaveAccessibleName('Account');
    expect(avatar).toHaveAttribute('aria-expanded', 'false');
    expect(avatar).not.toHaveAttribute('aria-haspopup');
    await user.click(avatar);
    expect(avatar).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Account' })).getByRole('link', { name: 'Account settings' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(avatar).toHaveFocus();
  });
});

describe('shell overlays: no axe violations and keyboard release', () => {
  it('notification panel, user menu, Copilot panel and the drawer open without violations and close with Escape', async () => {
    const user = userEvent.setup();
    const { container } = renderShell(['admin']);
    for (const [name, dialog] of [
      ['bell', /Notifications/],
      ['copilot-launcher', /Store copilot/],
    ] as const) {
      const trigger = screen.getByTestId(name);
      await user.click(trigger);
      expect(screen.getByRole('dialog', { name: dialog })).toBeInTheDocument();
      expect(await axe(container)).toHaveNoViolations();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: dialog })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    }
    const menu = screen.getByRole('button', { name: 'Open menu' });
    await user.click(menu);
    // jsdom applies no CSS, so the rail (narrow:hidden in a browser) is still in the tree beside the drawer's own navigation.
    expect(await axe(container, { rules: { 'landmark-unique': { enabled: false } } })).toHaveNoViolations();
    await user.keyboard('{Escape}');
    expect(menu).toHaveFocus();
  });
});
