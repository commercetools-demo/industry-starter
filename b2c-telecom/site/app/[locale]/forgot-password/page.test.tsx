import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';

vi.mock('next-intl/server', async () => (await import('@/test/fixtures/serverIntl')).serverIntlMock);

import ForgotPasswordPage, { generateMetadata } from './page';

describe('forgot password page', () => {
  it('renders the title, the subtitle, the email form and is noindex', async () => {
    renderWithProviders(await ForgotPasswordPage({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve({}) }));
    expect(screen.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeInTheDocument();
    expect(screen.getByText('Enter your email and we will prepare a reset link.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument();
    expect((await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }) })).robots).toMatchObject({ index: false });
  });

  it('de-DE copy', async () => {
    renderWithProviders(await ForgotPasswordPage({ params: Promise.resolve({ locale: 'de-DE' }), searchParams: Promise.resolve({}) }), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Passwort zurücksetzen' })).toBeInTheDocument();
  });
});
