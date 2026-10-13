// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartButton } from '@/components/shell/CartButton';
import { StoreChip } from '@/components/shell/StoreChip';
import { useStorePicker } from '@/context/StorePickerContext';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';
import { branches, branchesResponse } from '@/test/shell-fixtures';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => '/mau-reseller-north',
  useRouter: () => ({ refresh }),
}));
// next/dynamic: load the (mocked) module through React.lazy so the map renders in jsdom.
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>) => {
    const Lazy = lazy(loader);
    return (props: Record<string, unknown>) => (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  },
}));
vi.mock('@/components/store-picker/BranchMap', () => ({
  default: ({ branches: list, focusedKey, onFocus, center }: { branches: { key: string; name: string }[]; focusedKey: string | null; onFocus: (k: string) => void; center: { lat: number; lng: number } | null }) => (
    <div data-testid="map" data-center={center ? `${center.lat},${center.lng}` : ''}>
      {list.map((b) => (
        <button key={b.key} data-testid={`pin-${b.key}`} aria-pressed={b.key === focusedKey} onClick={() => onFocus(b.key)}>
          pin {b.name}
        </button>
      ))}
    </div>
  ),
}));

import { StorePickerHost } from './StorePickerHost';

type Call = { url: string; method: string; body?: string };
const state = {
  branches: branchesResponse(),
  geocode: { results: [] as { label: string; lat: number; lng: number }[], unavailable: false },
  calls: [] as Call[],
  cartCount: 0,
  failPost: false,
};
const geolocation = { getCurrentPosition: vi.fn() };

beforeEach(() => {
  state.branches = branchesResponse();
  state.geocode = { results: [], unavailable: false };
  state.calls = [];
  state.cartCount = 0;
  state.failPost = false;
  refresh.mockClear();
  window.sessionStorage.clear();
  geolocation.getCurrentPosition.mockReset();
  geolocation.getCurrentPosition.mockImplementation((_ok: unknown, err: (e: { code: number }) => void) => err({ code: 1 }));
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const call = { url, method: init?.method ?? 'GET', body: init?.body as string | undefined };
      state.calls.push(call);
      let body: unknown = {};
      if (url.startsWith('/api/store-context/branches')) body = state.branches;
      else if (url.startsWith('/api/store-context/geocode')) body = state.geocode;
      else if (url.startsWith('/api/store-context/branch') && state.failPost) return { ok: false, status: 500, json: async () => ({}) } as Response;
      else if (url.startsWith('/api/store-context/branch')) {
        const { branchKey } = JSON.parse(call.body ?? '{}');
        state.branches = { ...state.branches, selectedKey: branchKey, chosen: true };
        body = { ok: true, cartRepriced: false };
      } else if (url.startsWith('/api/cart/summary')) body = { count: state.cartCount };
      return { ok: true, status: 200, json: async () => body } as Response;
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const calls = (prefix: string) => state.calls.filter((c) => c.url.startsWith(prefix));

function Outside() {
  const { open } = useStorePicker();
  return <button onClick={open}>Change store (product page)</button>;
}

function renderPicker(initial = state.branches) {
  // The SWR cache is seeded with `initial` and revalidates against the fetch mock as soon as it mounts. If the mock answered with different
  // data (another `selectedKey`), the revalidation could land before the dialog opens and change the branch the picker focuses first: a race
  // that made the arrow key test flaky under load. Both sides now serve the same response.
  state.branches = initial;
  return renderWithProviders(
    <StorePickerHost initial={initial}>
      <StoreChip />
      <CartButton store="mau-reseller-north" />
      <Outside />
    </StorePickerHost>,
    { locale: 'en-US', messages: enUS },
  );
}
const dialog = () => screen.findByRole('dialog', { name: 'Choose your store' });
const openFromChip = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /Your store/ }));
  return dialog();
};

describe('Choose a store from list or map: opening', () => {
  it('opens by default only with no chosen branch and more than one branch', async () => {
    renderPicker(branchesResponse({ chosen: false }));
    expect(await dialog()).toBeInTheDocument();
  });
  it('does not open by itself when the shopper already chose a branch', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    await screen.findByRole('button', { name: /Your store/ });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('does not reopen in the same tab after it was dismissed', async () => {
    window.sessionStorage.setItem('picker-dismissed', '1');
    renderPicker(branchesResponse({ chosen: false }));
    await screen.findByRole('button', { name: /Your store/ });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('dismissing remembers it for the tab', async () => {
    renderPicker();
    const d = await dialog();
    await userEvent.click(within(d).getByRole('button', { name: 'Close' }));
    expect(window.sessionStorage.getItem('picker-dismissed')).toBe('1');
  });
  it('does not render for one branch', async () => {
    state.branches = branchesResponse({ single: true, chosen: false, branches: branches.slice(0, 1) });
    renderPicker(state.branches);
    await waitFor(() => expect(calls('/api/store-context/branches').length).toBeGreaterThan(0));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Your store')).not.toBeInTheDocument();
  });
  it('useStorePicker open() opens it from outside the header and returns focus to that opener', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const opener = await screen.findByRole('button', { name: 'Change store (product page)' });
    await userEvent.click(opener);
    await dialog();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
  it('escape closes and returns focus to the chip', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const chip = await screen.findByRole('button', { name: /Your store/ });
    await userEvent.click(chip);
    await dialog();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(chip).toHaveFocus();
  });
  it('never calls geolocation on mount', async () => {
    renderPicker();
    await dialog();
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe('Choose a store from list or map: list and map', () => {
  it('only the focused row shows the choose button', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    expect(within(d).getAllByRole('button', { name: 'Shop at this store' })).toHaveLength(1);
    await userEvent.click(within(d).getByRole('option', { name: /Küstenwerk Bremen/ }));
    const buttons = within(d).getAllByRole('button', { name: 'Shop at this store' });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('[role="group"]')).toHaveAccessibleName('Küstenwerk Bremen');
  });
  it('focus syncs between row and pin', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    const bremenPin = await within(d).findByTestId('pin-mau-br-north-bremen');
    await userEvent.click(within(d).getByRole('option', { name: /Küstenwerk Bremen/ }));
    expect(bremenPin).toHaveAttribute('aria-pressed', 'true');
    expect(within(d).getByTestId('pin-mau-br-north-berlin')).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(within(d).getByTestId('pin-mau-br-north-berlin'));
    expect(within(d).getByRole('option', { name: /Berlin-Mitte/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(d).getByRole('option', { name: /Küstenwerk Bremen/ })).toHaveAttribute('aria-selected', 'false');
  });
  it('arrow keys move the focused row and aria-activedescendant follows', async () => {
    renderPicker(branchesResponse({ chosen: true, selectedKey: 'mau-br-north-berlin' }));
    await waitFor(() => expect(calls('/api/store-context/branches').length).toBeGreaterThan(0)); // the revalidation has landed before the dialog opens: the worst case of the old race
    const d = await openFromChip();
    const list = within(d).getByRole('listbox', { name: 'Branches' });
    list.focus();
    const activeName = () => document.getElementById(list.getAttribute('aria-activedescendant')!)?.textContent ?? '';
    expect(activeName()).toContain('Berlin-Mitte');
    await userEvent.keyboard('{ArrowDown}');
    expect(activeName()).toContain('Küstenwerk Bremen');
    await userEvent.keyboard('{End}');
    expect(activeName()).toContain('Hamburg-Harburg');
    await userEvent.keyboard('{Home}');
    expect(activeName()).toContain('Berlin-Mitte');
    await userEvent.keyboard('{ArrowUp}');
    expect(activeName()).toContain('Berlin-Mitte');
  });
  it('Enter on the list moves keyboard focus to the choose button', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    within(d).getByRole('listbox').focus();
    await userEvent.keyboard('{Enter}');
    expect(within(d).getByRole('button', { name: 'Shop at this store' })).toHaveFocus();
  });
  it('rows state hours and pickup facts, closed stores show when they open', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    const berlin = within(d).getByRole('group', { name: 'Küstenwerk Berlin-Mitte' });
    expect(berlin).toHaveTextContent('Closed · opens 8 AM');
    expect(berlin).toHaveTextContent('Pickup tomorrow');
    const hamburg = within(d).getByRole('group', { name: 'Küstenwerk Hamburg-Harburg' });
    expect(hamburg).toHaveTextContent('Open until 8 PM');
    expect(hamburg).toHaveTextContent('Pickup today');
    expect(hamburg).toHaveTextContent('Your store');
  });
  it('postal prefix filters', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    await userEvent.type(within(d).getByRole('searchbox', { name: 'Postal code or city' }), '28');
    expect(within(d).getAllByRole('option')).toHaveLength(1);
    expect(within(d).getByRole('option')).toHaveTextContent('Bremen');
  });
  it('geocode result sorts by distance from the searched place', async () => {
    state.geocode = { results: [{ label: 'Lübeck', lat: 53.87, lng: 10.69 }], unavailable: false };
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    await userEvent.type(within(d).getByRole('searchbox', { name: 'Postal code or city' }), 'Lübeck');
    await waitFor(() => expect(within(d).getAllByRole('option')).toHaveLength(3), { timeout: 3000 });
    const names = within(d).getAllByRole('option').map((o) => o.textContent ?? '');
    expect(names[0]).toContain('Hamburg-Harburg');
    expect(names[0]).toMatch(/\d+ km/);
    expect(names[2]).toContain('Berlin-Mitte');
    expect(within(d).getByTestId('map')).toHaveAttribute('data-center', '53.87,10.69');
  });
  it('typing quickly sends one geocode request after the debounce and never calls a geocoder directly', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    await userEvent.type(within(d).getByRole('searchbox', { name: 'Postal code or city' }), 'Hamburg');
    expect(calls('/api/store-context/geocode')).toHaveLength(0);
    await waitFor(() => expect(calls('/api/store-context/geocode')).toHaveLength(1), { timeout: 3000 });
    expect(state.calls.every((c) => c.url.startsWith('/api/'))).toBe(true);
    expect(calls('/api/store-context/geocode')[0].url).toContain('q=Hamburg');
  });
  it('Enter searches at once', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    await userEvent.type(within(d).getByRole('searchbox', { name: 'Postal code or city' }), 'Bremen{Enter}');
    await waitFor(() => expect(calls('/api/store-context/geocode').length).toBeGreaterThanOrEqual(1));
  });
  it('geocoder failure leaves the text filter working', async () => {
    state.geocode = { results: [], unavailable: true };
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    await userEvent.type(within(d).getByRole('searchbox', { name: 'Postal code or city' }), 'Bremen');
    expect(within(d).getAllByRole('option')).toHaveLength(1);
    await waitFor(() => expect(within(d).getByRole('status')).toHaveTextContent('Place search is not available'), { timeout: 3000 });
    expect(within(d).getAllByRole('option')).toHaveLength(1);
  });
  it('a search without a match says so', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    await userEvent.type(within(d).getByRole('searchbox', { name: 'Postal code or city' }), 'zzz');
    expect(within(d).queryByRole('option')).not.toBeInTheDocument();
    expect(within(d).getByText('No branch matches your search.')).toBeInTheDocument();
  });
});

describe('Location permission is optional', () => {
  it('denied permission shows a hint and the list stays usable', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    await userEvent.click(within(d).getByRole('button', { name: 'Use my location' }));
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(await within(d).findByText('Location is off. Enter a postal code or city instead.')).toBeInTheDocument();
    await userEvent.click(within(d).getByRole('option', { name: /Küstenwerk Bremen/ }));
    expect(within(d).getByRole('option', { name: /Küstenwerk Bremen/ })).toHaveAttribute('aria-selected', 'true');
  });
  it('a granted position sorts by distance and recentres the map', async () => {
    geolocation.getCurrentPosition.mockImplementation((ok: (p: { coords: { latitude: number; longitude: number } }) => void) => ok({ coords: { latitude: 52.4, longitude: 13.1 } })); // Potsdam
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    await userEvent.click(within(d).getByRole('button', { name: 'Use my location' }));
    await waitFor(() => expect(within(d).getAllByRole('option')[0]).toHaveTextContent('Berlin-Mitte'));
    expect(within(d).getByTestId('map')).toHaveAttribute('data-center', '52.4,13.1');
  });
});

describe('Choosing', () => {
  it('choosing closes updates the chip and refreshes', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const chip = await screen.findByRole('button', { name: /Your store/ });
    expect(chip).toHaveTextContent('Küstenwerk Hamburg-Harburg');
    await userEvent.click(chip);
    const d = await dialog();
    await userEvent.click(within(d).getByRole('option', { name: /Küstenwerk Bremen/ }));
    await userEvent.click(within(d).getByRole('button', { name: 'Shop at this store' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const post = calls('/api/store-context/branch').find((c) => c.method === 'POST');
    expect(JSON.parse(post!.body!)).toEqual({ branchKey: 'mau-br-north-bremen' });
    expect(refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: /Your store/ })).toHaveTextContent('Küstenwerk Bremen'));
  });
  it('choosing refreshes the cart cache too', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    expect(await screen.findByRole('link', { name: 'Cart · 0' })).toBeInTheDocument();
    const before = calls('/api/cart/summary').length;
    state.cartCount = 2;
    const d = await openFromChip();
    await userEvent.click(within(d).getByRole('option', { name: /Küstenwerk Bremen/ }));
    await userEvent.click(within(d).getByRole('button', { name: 'Shop at this store' }));
    await waitFor(() => expect(calls('/api/cart/summary').length).toBeGreaterThan(before));
    expect(await screen.findByRole('link', { name: 'Cart · 2' })).toBeInTheDocument();
  });
  it('a failing request keeps the picker open with a message', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    state.failPost = true;
    await userEvent.click(within(d).getByRole('button', { name: 'Shop at this store' }));
    expect(await within(d).findByText('The store could not be changed. Please try again.')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('Keyboard and screen reader use', () => {
  it('has no axe violations', async () => {
    renderPicker(branchesResponse({ chosen: true }));
    const d = await openFromChip();
    await within(d).findByTestId('map');
    expect(await axe(d)).toHaveNoViolations();
  });
});
