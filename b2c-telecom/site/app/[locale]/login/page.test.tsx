import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';

vi.mock('next-intl/server', async () => (await import('@/test/fixtures/serverIntl')).serverIntlMock);
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import LoginPage, { generateMetadata } from './page';

async function open(locale: 'en-US' | 'de-DE', query: Record<string, string | string[]> = {}) {
  renderWithProviders(await LoginPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }), { locale });
}

describe('login page', () => {
  it('renders the card with the title, the subtitle, empty fields and no demo note', async () => {
    await open('en-US');
    expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByText('Access your plans, contract and bill.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
  });

  it('carries a validated return target to the form links and drops an unsafe one', async () => {
    await open('en-US', { returnTo: '/en-US/bundle' });
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/en-US/forgot-password?returnTo=%2Fen-US%2Fbundle');
  });

  it('an unsafe return target becomes /account', async () => {
    await open('en-US', { returnTo: 'https://evil.com' });
    expect(screen.getByRole('link', { name: 'New to Malva? Create an account' })).toHaveAttribute('href', '/en-US/register?returnTo=%2Fen-US%2Faccount');
  });

  it('accepts the older next parameter written by requireSession', async () => {
    await open('en-US', { next: '/account/orders' });
    expect(screen.getByRole('link', { name: 'New to Malva? Create an account' })).toHaveAttribute('href', '/en-US/register?returnTo=%2Fen-US%2Faccount%2Forders');
  });

  it('shows the "Password changed" notice only for reset=1', async () => {
    await open('en-US', { reset: '1' });
    expect(screen.getByText('Password changed. Log in with your new password.')).toBeInTheDocument();
  });

  it('does not show the notice by default', async () => {
    await open('en-US');
    expect(screen.queryByText('Password changed. Log in with your new password.')).not.toBeInTheDocument();
  });

  it('de-DE copy', async () => {
    await open('de-DE');
    expect(screen.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Passwort vergessen?' })).toBeInTheDocument();
  });

  it('is noindex', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }) });
    expect(metadata.robots).toMatchObject({ index: false });
    expect(metadata.title).toBe('Log in');
  });

  it('an unknown locale is a 404', async () => {
    await expect(LoginPage({ params: Promise.resolve({ locale: 'fr-FR' }), searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND');
  });
});
