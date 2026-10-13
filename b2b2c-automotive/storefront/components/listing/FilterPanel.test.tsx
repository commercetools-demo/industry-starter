// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FacetGroup } from '@/lib/types';
import { installFakeApi, renderVehicle, stateOf } from '@/test/vehicle';

const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: '' }));
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn(), replace }), usePathname: () => '/mau-reseller-north/category/brakes', Link: 'a' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search.value) }));

import { FilterPanel, FilterSheet } from './FilterPanel';

const groups = (over: { brandSelected?: string[] } = {}): FacetGroup[] => [
  {
    name: 'brand',
    param: 'brand',
    title: 'Brand',
    options: [
      { key: 'vektra', label: 'Vektra', count: 12, selected: over.brandSelected?.includes('vektra') ?? false },
      { key: 'alpendyn', label: 'Alpendyn', count: 3, selected: over.brandSelected?.includes('alpendyn') ?? false },
      { key: 'kestrel', label: 'Kestrel', count: 5, selected: over.brandSelected?.includes('kestrel') ?? false },
    ],
  },
  { name: 'position', param: 'attr.position', title: 'Position', options: [{ key: 'front', label: 'Front', count: 7, selected: false }, { key: 'rear', label: 'Rear', count: 2, selected: false }] },
];
const GOLF = stateOf('volkswagen.golf.2016.2-0-tdi');
const panel = (g = groups(), garage = stateOf(), pickupAvailable = true) =>
  renderVehicle(<FilterPanel groups={g} city="Hamburg" pickupAvailable={pickupAvailable} />, { garage, locale: 'en-US' });

beforeEach(() => {
  replace.mockReset();
  search.value = '';
  installFakeApi();
});
afterEach(() => vi.unstubAllGlobals());

describe('Brand options follow the result set: components/listing/FilterPanel', () => {
  it('brand list only has brands from the result facet and is alphabetical', () => {
    panel();
    const brand = screen.getByRole('group', { name: 'Brand' });
    const labels = within(brand).getAllByRole('checkbox').map((c) => c.closest('label')?.textContent);
    expect(labels).toEqual(['Alpendyn (3)', 'Kestrel (5)', 'Vektra (12)']);
    expect(screen.queryByRole('checkbox', { name: /Bosch/ })).not.toBeInTheDocument();
  });

  it('toggling brand updates URL and resets page', async () => {
    search.value = 'sort=price-asc&page=4';
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByRole('checkbox', { name: 'Vektra (12)' }));
    expect(replace).toHaveBeenCalledTimes(1);
    const [target, options] = replace.mock.calls[0];
    const url = new URL(target as string, 'http://x');
    expect(url.pathname).toBe('/mau-reseller-north/category/brakes');
    expect(url.searchParams.getAll('brand')).toEqual(['vektra']);
    expect(url.searchParams.get('sort')).toBe('price-asc');
    expect(url.searchParams.has('page')).toBe(false);
    expect(options).toEqual({ scroll: false });
  });

  it('unticking removes the value and keeps the others', async () => {
    search.value = 'brand=vektra&brand=kestrel';
    const user = userEvent.setup();
    panel(groups({ brandSelected: ['vektra', 'kestrel'] }));
    await user.click(screen.getByRole('checkbox', { name: 'Vektra (12)' }));
    expect(new URL(replace.mock.calls[0][0] as string, 'http://x').searchParams.getAll('brand')).toEqual(['kestrel']);
  });

  it('a part facet writes its attr parameter', async () => {
    const user = userEvent.setup();
    panel();
    await user.click(screen.getByRole('checkbox', { name: 'Front (7)' }));
    expect(new URL(replace.mock.calls[0][0] as string, 'http://x').searchParams.getAll('attr.position')).toEqual(['front']);
  });

  it('pickup label uses the city', async () => {
    const user = userEvent.setup();
    panel();
    const pickup = screen.getByRole('checkbox', { name: 'Pickup today at Hamburg' });
    expect(pickup).not.toBeChecked();
    await user.click(pickup);
    expect(new URL(replace.mock.calls[0][0] as string, 'http://x').searchParams.get('pickup')).toBe('1');
  });

  it('pickup is checked from the address and clears when unticked', async () => {
    search.value = 'pickup=1&page=2';
    const user = userEvent.setup();
    panel();
    const pickup = screen.getByRole('checkbox', { name: 'Pickup today at Hamburg' });
    expect(pickup).toBeChecked();
    await user.click(pickup);
    const url = new URL(replace.mock.calls[0][0] as string, 'http://x');
    expect(url.searchParams.has('pickup')).toBe(false);
    expect(url.searchParams.has('page')).toBe(false);
  });

  it('pickup is disabled with a hint for a store without branches', () => {
    panel(groups(), stateOf(), false);
    expect(screen.getByRole('checkbox', { name: 'Pickup today at Hamburg' })).toBeDisabled();
    expect(screen.getByText('Pickup is not available at this store.')).toBeInTheDocument();
  });

  it('fit toggle hidden without a vehicle', () => {
    panel();
    expect(screen.queryByRole('checkbox', { name: 'Fits my vehicle' })).not.toBeInTheDocument();
  });

  it('fit toggle shows with a vehicle', () => {
    panel(groups(), GOLF);
    expect(screen.getByRole('checkbox', { name: 'Fits my vehicle' })).toBeChecked();
  });

  it('no axe violations', async () => {
    const { container } = panel(groups(), GOLF);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Mobile filter sheet: components/listing/FilterSheet', () => {
  const sheet = () => renderVehicle(<FilterSheet groups={groups()} city="Hamburg" pickupAvailable />, { locale: 'en-US' });

  it('sheet opens and applies', async () => {
    search.value = 'sort=rated&page=2';
    const user = userEvent.setup();
    sheet();
    expect(screen.queryByRole('checkbox', { name: 'Vektra (12)' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Vektra (12)' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Pickup today at Hamburg' }));
    expect(replace).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    const url = new URL(replace.mock.calls[0][0] as string, 'http://x');
    expect(url.searchParams.getAll('brand')).toEqual(['vektra']);
    expect(url.searchParams.get('pickup')).toBe('1');
    expect(url.searchParams.get('sort')).toBe('rated');
    expect(url.searchParams.has('page')).toBe(false);
  });

  it('closing keeps the address', async () => {
    const user = userEvent.setup();
    sheet();
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByRole('checkbox', { name: 'Kestrel (5)' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows how many filters are active on the button', () => {
    search.value = 'pickup=1';
    renderVehicle(<FilterSheet groups={groups({ brandSelected: ['vektra'] })} city="Hamburg" pickupAvailable />, { locale: 'en-US' });
    expect(screen.getByRole('button', { name: 'Filters 2 active' })).toBeInTheDocument();
  });
});
