// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);
vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), notFound }));
vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));

import MalvaLayout from './layout';

describe('Malva layout', () => {
  it('renders the page inside the Malva shell', async () => {
    renderWithProviders(await MalvaLayout({ children: <p>page</p>, params: Promise.resolve({ locale: 'en-US' }) }));
    expect(screen.getByText('page')).toBeInTheDocument();
  });
  it('renders no reseller chrome: no cart, no store chip, no utility bar', async () => {
    renderWithProviders(await MalvaLayout({ children: <p>page</p>, params: Promise.resolve({ locale: 'en-US' }) }));
    expect(screen.queryByRole('link', { name: /cart/i })).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
  });
  it('an unsupported locale is not found', async () => {
    await expect(MalvaLayout({ children: null, params: Promise.resolve({ locale: 'fr-FR' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
