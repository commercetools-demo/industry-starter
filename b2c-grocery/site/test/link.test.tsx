/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen } from '@testing-library/react';
import { Link } from '@/i18n/routing';
import { renderWithProviders } from '@/test/utils';

describe('locale-aware Link', () => {
  it('Link preserves locale: renders the /de-DE prefix for de-DE', () => {
    renderWithProviders(<Link href="/shop">Shop</Link>, { locale: 'de-DE' });
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/de-DE/shop');
  });

  it('renders /en-US for en-US', () => {
    renderWithProviders(<Link href="/shop">Shop</Link>, { locale: 'en-US' });
    expect(screen.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/en-US/shop');
  });
});
