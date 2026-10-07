import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';

vi.mock('next-intl/server', async () => (await import('@/test/fixtures/serverIntl')).serverIntlMock);
vi.mock('@/i18n/routing', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/i18n/routing')>()), useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }) }));

import RegisterPage, { generateMetadata } from './page';

describe('register page', () => {
  it('renders the form, links back to login with the return target and is noindex', async () => {
    renderWithProviders(await RegisterPage({ params: Promise.resolve({ locale: 'en-US' }), searchParams: Promise.resolve({ returnTo: '/en-US/bundle' }) }));
    expect(screen.getByRole('heading', { level: 1, name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Already have an account? Log in' })).toHaveAttribute('href', '/en-US/login?returnTo=%2Fen-US%2Fbundle');
    expect((await generateMetadata({ params: Promise.resolve({ locale: 'en-US' }) })).robots).toMatchObject({ index: false });
  });

  it('de-DE copy', async () => {
    renderWithProviders(await RegisterPage({ params: Promise.resolve({ locale: 'de-DE' }), searchParams: Promise.resolve({}) }), { locale: 'de-DE' });
    expect(screen.getByRole('heading', { level: 1, name: 'Konto erstellen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Vorname')).toBeInTheDocument();
  });
});
