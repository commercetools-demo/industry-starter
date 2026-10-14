/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { AccountLink } from './AccountLink';

describe('AccountLink', () => {
  it('Anonymous buyer: reads Log in and links to /login', () => {
    renderWithProviders(<AccountLink signedIn={false} />);
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/en-US/login');
  });

  it('Signed-in buyer: reads Hi, Alex and links to /account', () => {
    renderWithProviders(<AccountLink signedIn firstName="Alex" />);
    expect(screen.getByRole('link', { name: 'Hi, Alex' })).toHaveAttribute('href', '/en-US/account');
  });

  it('an empty first name reads My account', () => {
    renderWithProviders(<AccountLink signedIn firstName="" />);
    expect(screen.getByRole('link', { name: 'My account' })).toHaveAttribute('href', '/en-US/account');
  });

  it('de-DE texts', () => {
    renderWithProviders(
      <>
        <AccountLink signedIn={false} />
        <AccountLink signedIn firstName="Alex" />
      </>,
      { locale: 'de-DE' },
    );
    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/de-DE/login');
    expect(screen.getByRole('link', { name: 'Hallo, Alex' })).toHaveAttribute('href', '/de-DE/account');
  });

  it('a long name is truncated to a maximum width', () => {
    renderWithProviders(<AccountLink signedIn firstName="Bartholomew" />);
    expect(screen.getByRole('link')).toHaveClass('max-w-40', 'truncate');
  });
});
