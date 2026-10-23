import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unstable_serialize } from 'swr';
import { keyChannels } from '@/lib/cache-keys';
import { CLOSED_ALL_WEEK } from '@/lib/hours';
import type { Category, Store } from '@/lib/types';
import { expectNoAxeViolations } from '@/test/axe';
import { nav, renderShell, stubFetch } from '@/test/shell';

vi.mock('@/i18n/routing', async () => (await import('@/test/shell')).routingMock());

import MobileNav from '@/components/layout/MobileNav';
import { useShellUi } from '@/context/shell-ui-context';

const cat = (key: string, slug: string, children: Category[] = []): Category => ({ id: key, key, name: slug, slug, children });
const TREE: Category[] = [
  cat('mcf-cat-pods', 'pods', [cat('mcf-cat-pods-original', 'original'), cat('mcf-cat-pods-vertuo', 'vertuo')]),
  cat('mcf-cat-coffee', 'coffee', [cat('mcf-cat-coffee-beans', 'beans')]),
  cat('mcf-cat-machines', 'machines'),
  cat('mcf-cat-accessories', 'accessories'),
  cat('mcf-cat-gifts', 'gifts'),
];
const STORE: Store = {
  id: 's1', key: 'mcf-store-a', name: 'A', addressLine: '', city: 'New York', postalCode: '', country: 'US',
  hours: CLOSED_ALL_WEEK, timeZone: 'America/New_York', collectionMinutes: 15,
};
const fallback = (stores: Store[], country = 'US') => ({
  [unstable_serialize(keyChannels(country))]: { stores, selectedKey: null },
});

function LocaleFlag() {
  const { localeOpen } = useShellUi();
  return <p data-testid="locale-flag">{String(localeOpen)}</p>;
}

function setup(stores: Store[] = [STORE], locale = 'en-US') {
  stubFetch({});
  renderShell(
    <>
      <MobileNav categories={TREE} />
      <LocaleFlag />
    </>,
    { fallback: fallback(stores, locale === 'en-US' ? 'US' : 'CA'), locale },
  );
}
const dialog = () => screen.getByRole('dialog', { hidden: true });

beforeEach(() => {
  nav.pathname = '/';
});
afterEach(() => vi.unstubAllGlobals());

describe('MobileNav', () => {
  it('is closed and inert until the menu button is pressed', async () => {
    setup();
    expect(dialog()).toHaveAttribute('aria-hidden', 'true');
    expect(dialog()).toHaveAttribute('inert');
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(dialog()).toHaveAttribute('aria-hidden', 'false');
    expect(dialog()).toHaveAccessibleName('Menu');
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
  });

  it('Navigating from the panel closes it and changes the page', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const link = within(dialog()).getByRole('link', { name: 'Machines' });
    expect(link).toHaveAttribute('href', '/category/machines');
    link.addEventListener('click', (e) => e.preventDefault()); // jsdom cannot navigate
    await userEvent.click(link);
    expect(dialog()).toHaveAttribute('aria-hidden', 'true');
  });

  it('traps focus', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(within(dialog()).getByRole('button', { name: 'Close menu' })).toHaveFocus();
    const focusables = within(dialog())
      .getAllByRole('link')
      .concat(within(dialog()).getAllByRole('button'));
    expect(focusables.length).toBeGreaterThan(5);
    // Shift+Tab from the first element wraps to the last one inside the panel.
    await userEvent.tab({ shift: true });
    expect(dialog().contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(dialog()).toHaveAttribute('aria-hidden', 'true');
  });

  it('accordion opens one at a time', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const podsToggle = within(dialog()).getByRole('button', { name: 'Show Pods categories' });
    const coffeeToggle = within(dialog()).getByRole('button', { name: 'Show Coffee categories' });
    await userEvent.click(podsToggle);
    expect(podsToggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog()).getByRole('link', { name: 'Vertuo' })).toBeVisible();
    await userEvent.click(coffeeToggle);
    expect(coffeeToggle).toHaveAttribute('aria-expanded', 'true');
    expect(podsToggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog()).queryByRole('link', { name: 'Vertuo' })).toBeNull();
    expect(within(dialog()).getByRole('link', { name: 'Beans' })).toBeVisible();
  });

  it('secondary rows replace the hidden pills', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(within(dialog()).getByRole('button', { name: 'Choose a store' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('link', { name: 'My account' })).toHaveAttribute('href', '/account');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Country and language' }));
    expect(screen.getByTestId('locale-flag')).toHaveTextContent('true');
    expect(dialog()).toHaveAttribute('aria-hidden', 'true');
  });

  it('has no store row in the Canada market', async () => {
    setup([], 'en-CA');
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(within(dialog()).queryByRole('button', { name: 'Choose a store' })).toBeNull();
  });

  it('no axe violations when open', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await expectNoAxeViolations(document.body);
  });
});
