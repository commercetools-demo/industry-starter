// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
const redirect = vi.hoisted(() => vi.fn(() => {
  throw new Error('NEXT_REDIRECT');
}));
const getMalvaListing = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), notFound }));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));
vi.mock('@/i18n/routing', () => ({ redirect }));
vi.mock('@/lib/listing/malva-load', () => ({ getMalvaListing }));

import MalvaCategoryPage from './page';

const props = (slug: string, locale = 'en-US') => ({ params: Promise.resolve({ locale, slug }), searchParams: Promise.resolve({}) });
const params = { page: 3, sort: 'popular', sortGiven: false, fit: true, brand: [], pickup: false, attrs: {} };

beforeEach(() => {
  notFound.mockClear();
  redirect.mockClear();
  getMalvaListing.mockReset();
});

describe('Malva category page', () => {
  it('Unknown category is not found', async () => {
    getMalvaListing.mockResolvedValue({ kind: 'not-found' });
    await expect(MalvaCategoryPage(props('nope'))).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('Unsupported locale is not found and nothing is read', async () => {
    await expect(MalvaCategoryPage(props('brakes', 'fr-FR'))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getMalvaListing).not.toHaveBeenCalled();
  });
  it('A page past the last redirects to the last page of the Malva address', async () => {
    getMalvaListing.mockResolvedValue({ kind: 'redirect', page: 2, params });
    await expect(MalvaCategoryPage(props('brakes'))).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith({ href: '/categories/brakes?page=2', locale: 'en-US' });
  });
  it('A category renders its name and count', async () => {
    getMalvaListing.mockResolvedValue({ kind: 'ok', category: { id: 'c', slug: 'brakes', name: 'Brakes', ancestors: [] }, params, result: { items: [], total: 5, page: 1, totalPages: 1, facets: [] }, fitScopeOn: false });
    renderWithProviders((await MalvaCategoryPage(props('brakes'))) ?? <></>);
    expect(screen.getByRole('heading', { name: 'Brakes' })).toBeInTheDocument();
  });
});
