import { screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { KEY_ACCOUNT } from '@/lib/cache-keys';
import { AccountLink } from './AccountLink';

afterEach(() => vi.unstubAllGlobals());

function renderLink(user: { id: string; email: string; firstName: string; lastName: string } | null, locale: 'en-US' | 'de-DE' = 'en-US') {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ user }), { status: 200 })));
  return renderWithProviders(
    <SWRConfig value={{ fallback: { [KEY_ACCOUNT]: user } }}>
      <AccountLink />
    </SWRConfig>,
    { locale },
  );
}

describe('AccountLink', () => {
  it('anonymous: "Sign in" icon button linking to the sign-in page', () => {
    renderLink(null);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en-US/account/sign-in');
  });

  it('signed in: links to the dashboard and names the shopper', () => {
    renderLink({ id: 'c', email: 'a@b.co', firstName: 'Ada', lastName: 'L' });
    const link = screen.getByRole('link', { name: 'Account, Ada' });
    expect(link).toHaveAttribute('href', '/en-US/account');
    expect(link).toHaveTextContent('Ada');
  });

  it('signed in without a first name: plain "Account"', () => {
    renderLink({ id: 'c', email: 'a@b.co', firstName: '', lastName: '' });
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/en-US/account');
  });

  it('German labels', () => {
    renderLink(null, 'de-DE');
    expect(screen.getByRole('link', { name: 'Anmelden' })).toHaveAttribute('href', '/de-DE/account/sign-in');
  });
});
