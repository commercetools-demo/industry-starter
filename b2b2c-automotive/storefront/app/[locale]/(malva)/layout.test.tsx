// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), notFound }));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));
const categories = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ct/malva-catalog', () => ({ getMalvaNavCategories: categories }));
// Header, footer and drawer host are covered by the shell tests.
vi.mock('@/components/malva/MalvaShell', () => ({
  MalvaShell: ({ locale, categories: nav, children }: { locale: string; categories: { name: string }[]; children: ReactNode }) => (
    <div data-testid="shell" data-locale={locale} data-categories={nav.map((c) => c.name).join(',')}>
      {children}
    </div>
  ),
}));

import MalvaLayout from './layout';

beforeEach(() => {
  categories.mockReset().mockResolvedValue([{ id: 'c1', slug: 'brakes', name: 'Brakes' }]);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('Malva layout', () => {
  it('renders the page inside the Malva shell with the locale and the categories', async () => {
    render(await MalvaLayout({ children: <p>page</p>, params: Promise.resolve({ locale: 'en-US' }) }));
    const shell = screen.getByTestId('shell');
    expect(shell).toContainElement(screen.getByText('page'));
    expect(shell).toHaveAttribute('data-locale', 'en-US');
    expect(shell).toHaveAttribute('data-categories', 'Brakes');
    expect(categories).toHaveBeenCalledWith('en-US');
  });
  it('a category outage leaves the navigation empty, the page renders', async () => {
    categories.mockRejectedValue(new Error('down'));
    render(await MalvaLayout({ children: <p>page</p>, params: Promise.resolve({ locale: 'de-DE' }) }));
    expect(screen.getByTestId('shell')).toHaveAttribute('data-categories', '');
    expect(screen.getByText('page')).toBeInTheDocument();
  });
  it('an unsupported locale is not found', async () => {
    await expect(MalvaLayout({ children: null, params: Promise.resolve({ locale: 'fr-FR' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
