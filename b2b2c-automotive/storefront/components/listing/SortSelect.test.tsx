// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import enUS from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/render';

const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: '' }));
vi.mock('@/i18n/routing', () => ({ useRouter: () => ({ replace }), usePathname: () => '/mau-reseller-north/parts' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search.value) }));

import { SortSelect } from './SortSelect';

const view = (value: 'popular' | 'relevance' | 'rated' = 'popular', hasQuery = false) => renderWithProviders(<SortSelect value={value} hasQuery={hasQuery} />, { locale: 'en-US', messages: enUS });

beforeEach(() => {
  replace.mockReset();
  search.value = '';
});

describe('Sort options: components/listing/SortSelect', () => {
  it('sort options and URL', async () => {
    const user = userEvent.setup();
    view();
    const select = screen.getByRole('combobox', { name: 'Sort by' });
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Most popular', 'Price low to high', 'Price high to low', 'Top rated']);
    await user.selectOptions(select, 'price-asc');
    expect(replace).toHaveBeenCalledWith('/mau-reseller-north/parts?sort=price-asc', { scroll: false });
  });

  it('keeps the other parameters and resets the page', async () => {
    search.value = 'brand=vektra&page=3&fit=0';
    const user = userEvent.setup();
    view();
    await user.selectOptions(screen.getByRole('combobox'), 'rated');
    const url = new URL(replace.mock.calls[0][0] as string, 'http://x');
    expect(url.searchParams.get('brand')).toBe('vektra');
    expect(url.searchParams.get('fit')).toBe('0');
    expect(url.searchParams.get('sort')).toBe('rated');
    expect(url.searchParams.has('page')).toBe(false);
  });

  it('the default sort of a listing removes the parameter', async () => {
    search.value = 'sort=rated';
    const user = userEvent.setup();
    view('rated');
    await user.selectOptions(screen.getByRole('combobox'), 'popular');
    expect(replace).toHaveBeenCalledWith('/mau-reseller-north/parts', { scroll: false });
  });

  it('a search offers best match first and keeps an explicit popular sort', async () => {
    search.value = 'q=brake';
    const user = userEvent.setup();
    view('relevance', true);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('relevance');
    expect(select.querySelectorAll('option')[0]).toHaveTextContent('Best match');
    await user.selectOptions(select, 'popular');
    expect(replace).toHaveBeenCalledWith('/mau-reseller-north/parts?q=brake&sort=popular', { scroll: false });
  });
});
