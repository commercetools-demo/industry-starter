// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, renderVehicle, stateOf } from '@/test/vehicle';
import { FitToggle } from './FitToggle';

const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: '' }));
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ refresh: vi.fn(), replace }), usePathname: () => '/store/parts', Link: 'a' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search.value) }));

beforeEach(() => {
  replace.mockReset();
  search.value = '';
});
afterEach(() => vi.unstubAllGlobals());

const GOLF = stateOf('volkswagen.golf.2016.2-0-tdi');

describe('Fits my vehicle toggle', () => {
  it('is rendered only when a vehicle is active', () => {
    installFakeApi();
    renderVehicle(<FitToggle />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('is on by default and off with fit=0', () => {
    installFakeApi(GOLF);
    const { unmount } = renderVehicle(<FitToggle />, { garage: GOLF });
    expect(screen.getByRole('checkbox', { name: 'Fits my vehicle' })).toBeChecked();
    unmount();
    search.value = 'fit=0';
    renderVehicle(<FitToggle />, { garage: GOLF });
    expect(screen.getByRole('checkbox', { name: 'Fits my vehicle' })).not.toBeChecked();
  });

  it('toggle writes fit=0 and keeps brand and sort', async () => {
    installFakeApi(GOLF);
    search.value = 'brand=bosch&sort=price-asc&page=3';
    const user = userEvent.setup();
    renderVehicle(<FitToggle />, { garage: GOLF });
    await user.click(screen.getByRole('checkbox', { name: 'Fits my vehicle' }));
    expect(replace).toHaveBeenCalledTimes(1);
    const target = replace.mock.calls[0][0] as string;
    const url = new URL(target, 'http://x');
    expect(url.pathname).toBe('/store/parts');
    expect(url.searchParams.get('fit')).toBe('0');
    expect(url.searchParams.get('brand')).toBe('bosch');
    expect(url.searchParams.get('sort')).toBe('price-asc');
    expect(url.searchParams.has('page')).toBe(false);
  });

  it('turning it back on removes fit and keeps the rest', async () => {
    installFakeApi(GOLF);
    search.value = 'fit=0&brand=bosch';
    const user = userEvent.setup();
    renderVehicle(<FitToggle />, { garage: GOLF });
    await user.click(screen.getByRole('checkbox', { name: 'Fits my vehicle' }));
    expect(replace).toHaveBeenCalledWith('/store/parts?brand=bosch', { scroll: false });
  });

  it('a bare path stays bare', async () => {
    installFakeApi(GOLF);
    search.value = 'fit=0';
    const user = userEvent.setup();
    renderVehicle(<FitToggle />, { garage: GOLF });
    await user.click(screen.getByRole('checkbox', { name: 'Fits my vehicle' }));
    expect(replace).toHaveBeenCalledWith('/store/parts', { scroll: false });
  });
});
